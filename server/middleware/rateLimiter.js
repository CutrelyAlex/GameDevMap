const rateLimit = require('express-rate-limit');

// 提交限流：每 IP 每小时最多 3 次提交
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 3, // 最多 3 次请求
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '提交过于频繁，请 1 小时后再试',
    retryAfter: '1 hour'
  },
  standardHeaders: true, // 返回 rate limit 信息在 `RateLimit-*` headers
  legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // 即使成功也计数
  skipFailedRequests: false // 失败请求也计数
});

// 通用 API 限流：每 IP 每 15 分钟最多 100 次请求
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 认证限流：每 IP 每 15 分钟最多 5 次登录尝试
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '登录尝试过多，请 15 分钟后再试',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // 成功的登录不计数
});

module.exports = {
  submissionLimiter,
  apiLimiter,
  authLimiter
};
