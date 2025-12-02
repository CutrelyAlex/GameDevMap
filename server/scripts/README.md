# Scripts 目录

维护脚本集合。这些是一次性或按需执行的工具脚本，非常驻服务。

## 文件说明

| 脚本 | 功能 | 用途 | 
|------|------|------|
| `create-admin.js` | 创建管理员账户 | CLI 工具 |
| `migrate-clubs.js` | JSON→DB 迁移 | 初始化数据库 |
| `sync-to-json.js` | DB→JSON 同步 | 核心模块，被 routes 引用 |
| `validate-database.js` | 数据库验证 | 检查数据完整性 |
| `cleanup-orphaned-logos.js` | 清理孤立 Logo 文件 | 定期维护 |
| `reset-index-field.js` | 重置社团索引 | 按名称/学校/时间排序 |

## 使用方法

### 创建管理员
```bash
node server/scripts/create-admin.js <username> <password> <email> [role]
# 示例：
node server/scripts/create-admin.js admin Admin@123 admin@example.com super_admin
```

### 导入 JSON 到数据库
```bash
node server/scripts/migrate-clubs.js
```

### 验证数据库
```bash
node server/scripts/validate-database.js
```

### 清理孤立 Logo
```bash
node server/scripts/cleanup-orphaned-logos.js
```

### 重置社团索引
```bash
node server/scripts/reset-index-field.js [--by-name|--by-school|--by-creation]
# 默认按名称排序
```

## 命名规范

所有脚本采用 **kebab-case** 命名规范（如 `sync-to-json.js`）。

## 注意

- `sync-to-json.js` 是核心脚本，被路由模块引用
- 其他脚本主要用于 CLI 调用或定期维护
