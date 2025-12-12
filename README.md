# 全国高校游戏开发社团地图

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)   

一个功能完整的全国高校游戏开发社团互动地图平台，包含前端展示、后端管理、数据同步等完整功能。

## 快速开始

### 在线访问
- **当前部署于**：http://8.163.12.243

## 联系方式
![QQ](https://img.shields.io/badge/QQ-2470819243-blue?style=flat&logo=qq)

如果这个项目对你有帮助，欢迎赞助支持项目的发展！

### 赞助方式

<table>
<tr>
<td valign="top">
<img src="/public/assets/payment.jpg" alt="赞助二维码" width="200" height="267" />
</td>
<td valign="top" style="padding-left: 20px;">
您的支持将帮助我们：<br>
- 🖥️ 维护服务器运行成本<br>
- 🗺️ 地图服务成本<br>
- ☕ 喝一杯咖啡/奶茶
</td>
</tr>
</table>

### 本地开发环境搭建

#### 环境要求
- Node.js 16+
- MongoDB 4.0+
- Python 3.6+ (用于图片压缩)

> 迁移说明：本仓库正在推进 `specs/001-python-sql-refactor/` 的 Python + SQL 单一数据源重构。迁移窗口内 `server/`（Node）与 `backend/`（Python）会并存，用于对照与回滚。

#### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/CutrelyAlex/GameDevMap.git
   cd GameDevMap
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **环境配置**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，配置数据库连接等信息
   ```

4. **生成JWT密钥**
   ```bash
   npm run generate:jwt
   ```

5. **启动MongoDB服务**
   ```bash
   # 确保MongoDB正在运行
   ```

6. **初始化管理员账户**
   ```bash
   npm run seed:admin
   ```

7. **启动开发服务器**
   ```bash
   npm run dev
   ```

8. **访问应用**
   - 前端：http://localhost:3000
   - 管理后台：http://localhost:3000/admin

#### 启动 Python 后端（重构中）

> 目标：替代 Node 后端提供 `/api/*`，并以 SQLite（默认 `data/gamedevmap.db`）作为权威数据源。

1. 安装 Python 依赖（见 `backend/requirements.txt`）
2. 配置环境变量（建议从 `.env.example` 合并到你的 `.env`）：至少需要 `JWT_SECRET`，以及 `DB_PATH` 或 `DATABASE_URL`
3. 启动：`uvicorn backend.app:app --host 0.0.0.0 --port 3001`

启动后可访问健康检查：`GET /api/health`

### 数据迁移（可选）

如果需要从JSON文件迁移数据到数据库：
```bash
npm run migrate:clubs
```

## 使用指南

### 添加社团Logo

1. 将Logo图片上传到 `public/assets/logos/` 目录
2. 运行图片压缩脚本：
   ```bash
   npm run compress:images
   ```
3. 在提交表单或管理后台中选择对应的Logo文件

### 数据同步

项目支持多种数据同步模式：

```bash
# JSON -> MongoDB 完全替换
npm run sync:json

# 双向智能合并
npm run sync:merge

# 仅更新现有记录
npm run sync:update

# 仅添加新记录
npm run sync:addOnly
```


## 项目架构

```
GameDevMap/
├── server/                 # 后端服务
│   ├── index.js           # 主服务器文件
│   ├── models/            # 数据模型
│   ├── routes/            # API路由
│   ├── middleware/        # 中间件
│   ├── scripts/           # 维护脚本
│   └── utils/             # 工具函数
├── public/                # 前端静态文件
│   ├── index.html         # 主页
│   ├── admin/             # 管理后台
│   ├── submit.html        # 提交页面
│   ├── css/               # 样式文件
│   ├── js/                # 前端脚本
│   └── assets/            # 静态资源
├── scripts/               # 工具脚本
├── specs/                 # 项目规范文档
├── docs/                  # 详细文档
└── data/                  # 数据文件
```

## 贡献指南

### 添加新社团

1. **在线提交**：访问提交页面直接填写信息
2. **Pull Request**：
   - Fork 本仓库
   - 在 `public/data/clubs.json` 中添加社团信息
   - 上传Logo到 `public/assets/logos/`
   - 提交 PR

### 社团数据格式

```json
{
  "id": "unique-club-id",
  "name": "社团名称",
  "school": "学校名称",
  "city": "城市名称",
  "province": "省份名称",
  "coordinates": [经度, 纬度],
  "logo": "logo-filename.png",
  "shortDescription": "简短介绍",
  "description": "详细介绍",
  "tags": ["正式社团", "Unity", "游戏开发"],
  "externalLinks": [
    {
      "type": "官网(此处可以是任何外链、也可以是信息)",
      "url": "https://example.com(也可以不是网址)"
    }
  ]
}
```

### 开发贡献

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -m 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 创建 Pull Request

## 重要声明

### 免责声明

**本项目仅用于学术交流和信息共享目的。所有社团信息均由用户自行提交，本项目不对信息的准确性、真实性或合法性承担任何责任。**

### 注意事项

1. **社团类型标识**：
   - 请在标签中明确标识：`正式社团` 或 `非正式社团`
   - 非正式社团包括同好会、学生组织、兴趣小组等
   - 正式社团指学校承认的社团/工作室组织

2. **学校政策**：不同学校对社团宣传政策可能不同，建议咨询学校相关部门

**特别提醒：本项目不对任何因使用本网站信息而产生的后果承担责任。请用户自行判断和承担风险。**
