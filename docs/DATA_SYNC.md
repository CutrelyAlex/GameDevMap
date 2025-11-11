# 数据同步系统 (Data Sync System)

## 概述

GameDevMap使用双数据源策略：
1. **MongoDB数据库** - 动态数据存储，支持实时更新
2. **clubs.json文件** - 静态数据备份，支持离线访问和开源贡献

系统自动保持两者同步，确保数据一致性。

## 数据流向

```
用户提交
    ↓
MongoDB (Submissions)
    ↓
管理员审批
    ↓
MongoDB (Clubs) ←→ clubs.json
    ↓              ↓
  API端点      静态备份
    ↓              ↓
  地图显示      离线访问
```

## 自动同步

### 审批时自动同步
当管理员批准社团提交时，系统会：
1. 将数据写入MongoDB的Club集合
2. 自动触发`syncToJson`脚本
3. 更新`public/data/clubs.json`文件

**实现位置**: `server/routes/submissions.js` (approve endpoint)

### 前端数据加载
前端优先从API加载数据，失败时回退到静态文件

**实现位置**: `public/js/script.js` (loadData function)

## 手动同步命令

### JSON → MongoDB (导入)
```bash
npm run migrate:clubs
```

**用途**:
- 初始化数据库
- 从静态文件恢复数据
- 导入社区贡献的新社团
- 同步：删除数据库中存在但 clubs.json 中不存在的社团

**脚本**: `server/scripts/migrateClubs.js`

### MongoDB → JSON (导出)
```bash
npm run sync:json
```

**用途**:
- 手动更新静态文件
- 创建数据备份
- 生成开源数据包

**脚本**: `server/scripts/syncToJson.js`

## 开源贡献工作流

### 场景1: 通过提交表单添加社团
```
开发者填写表单 → 管理员审批 → 自动同步到clubs.json → 无需手动操作
```

### 场景2: 直接修改clubs.json (GitHub PR)
```bash
# 1. Fork项目并修改 public/data/clubs.json
# 2. 提交PR并合并
# 3. 部署后运行迁移命令
npm run migrate:clubs
```

### 场景3: 直接在数据库中修改
```bash
# 1. 通过MongoDB工具修改数据
# 2. 运行同步命令
npm run sync:json
# 3. 提交更新后的clubs.json到Git
```
   
## 备份策略

### 自动备份
`syncToJson`脚本运行时会自动创建备份：
```
public/data/clubs.json.backup
```

### Git版本控制
clubs.json文件被Git跟踪，每次更新都会被记录：
```bash
git log public/data/clubs.json
```

## 故障恢复

### 情况1: clubs.json丢失
```bash
npm run sync:json
```

### 情况2: MongoDB数据丢失
```bash
npm run migrate:clubs
```

### 情况3: 数据不一致
```bash
# 以MongoDB为准
npm run sync:json

# 或以clubs.json为准
npm run migrate:clubs
```

## API端点

### 获取所有社团
```
GET /api/clubs
Response: {success: true, data: [...], total: 100}
```

### 获取单个社团
```
GET /api/clubs/:id
Response: {success: true, data: {...}}
```
## 监控和日志

所有同步操作都会输出详细日志：
```bash
# 查看服务器日志
pm2 logs gamedevmap-api
```