# Routes 目录

API 路由定义。

## 文件说明

| 文件 | 功能 |
|------|------|
| `auth.js` | 管理员登录/验证 (`/api/auth`) |
| `clubs.js` | 社团 CRUD (`/api/clubs`) |
| `submissions.js` | 提交管理和审核 (`/api/submissions`) |
| `sync.js` | DB↔JSON 同步和 Git 操作 (`/api/sync`) |
| `upload.js` | 文件上传 (`/api/upload`) |

## 架构

- `submissions/` - 提交模块（controller + routes 拆分）
- `sync/` - 同步模块（helpers + routes 拆分）
