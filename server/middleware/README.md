# Middleware 目录

Express 中间件集合。

## 文件说明

| 文件 | 功能 |
|------|------|
| `auth.js` | JWT 认证、IP 白名单、Git 操作权限验证 |
| `rateLimiter.js` | 请求频率限制（提交/API/登录） |
| `upload.js` | Multer 文件上传配置和错误处理 |
| `validate.js` | Joi 数据验证（提交表单 schema） |
