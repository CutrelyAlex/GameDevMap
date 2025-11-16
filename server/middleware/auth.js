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

    // 如果是数据库连接问题，返回服务不可用而不是未授权
    if (error.message.includes('MongoDB') || error.name === 'MongooseError') {
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: '数据库连接暂时不可用，请稍后再试'
      });
    }

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

/**
 * Git 操作 API 中间件
 * 仅允许具有特定权限的管理员执行 Git 命令
 * 支持远程访问，但需要：
 * 1. 有效的 JWT Token
 * 2. Admin 角色
 * 3. 可选的 Git 操作白名单（ENABLE_GIT_OPERATIONS 环境变量）
 */
function authenticateGitOperations(req, res, next) {
  // 先进行标准认证
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

    // 检查是否为 admin 角色
    if (decoded.role !== 'admin') {
      console.warn(`⚠️ 非管理员用户尝试 Git 操作: ${decoded.username}`);
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '仅管理员可执行 Git 操作'
      });
    }

    // 检查是否启用了 Git 操作
    const gitEnabled = process.env.ENABLE_GIT_OPERATIONS === 'true';
    if (!gitEnabled) {
      console.warn('⚠️ Git 操作未启用（ENABLE_GIT_OPERATIONS=true）');
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Git 操作功能未启用'
      });
    }

    // 记录 Git 操作请求
    const clientIp = getClientIp(req);
    console.log(`🔐 Git 操作授权: 用户=${decoded.username}, IP=${clientIp}, 操作=${req.method} ${req.path}`);

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    next();
  } catch (error) {
    console.warn('JWT 验证失败：', error.message);

    if (error.message.includes('MongoDB') || error.name === 'MongooseError') {
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: '数据库连接暂时不可用，请稍后再试'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '身份验证失败或已过期'
    });
  }
}

module.exports = {
  authenticate,
  authenticateGitOperations,
  issueToken
};
