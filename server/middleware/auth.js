const jwt = require('jsonwebtoken');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const [first] = forwarded.split(',').map(ip => ip.trim());
    if (first) {
      return first;
    }
  }
  return req.ip || req.connection?.remoteAddress || '';
}

function getWhitelist() {
  const raw = process.env.ADMIN_IP_WHITELIST;
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '缺少身份验证信息'
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Token 不合法'
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET 未配置');
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '服务器配置错误，无法验证身份'
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (!decoded?.id) {
      throw new Error('Invalid payload');
    }

    const whitelist = getWhitelist();
    if (whitelist.length) {
      const clientIp = getClientIp(req);
      if (!whitelist.includes(clientIp)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '当前 IP 不在允许的管理员访问列表中'
        });
      }
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    next();
  } catch (error) {
    console.warn('JWT 验证失败：', error.message);
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '身份验证失败或已过期'
    });
  }
}

function issueToken(payload, options = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 未配置');
  }
  return jwt.sign(payload, secret, {
    expiresIn: '24h',
    ...options
  });
}

module.exports = {
  authenticate,
  issueToken
};
