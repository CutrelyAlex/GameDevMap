# 全国高校游戏开发社团地图

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)   

一个功能完整的全国高校游戏开发社团互动地图平台，包含前端展示、后端管理、数据同步等完整功能。

## 快速开始

### 在线访问
- **当前部署于**：http://8.163.12.243
- 欢迎加入作者的QQ群交流：1076040464

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
- Python 3.6+ (用于图片压缩)

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

### 数据迁移（可选）

如果需要从JSON文件迁移数据到数据库：
```bash
npm run migrate:clubs
```

## 项目架构

```
待更新
```

## 贡献指南

### 添加新社团

**在线提交**：现在请通过访问提交页面直接填写信息，审核通过后会同步到仓库中。

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
