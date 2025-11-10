# 全国高校游戏社团地图

一个用于展示和连接全国高校游戏社团的互动地图网站。

## 快速开始

### 本地运行

1. 克隆仓库：
   ```bash
   git clone https://github.com/CutrelyAlex/GameDevMap.git
   cd GameDevMap
   ```

2. 启动本地服务器：
   ```bash
   # 使用 Python
   python -m http.server 8000
   
   # 或使用 Node.js
   npx http-server
   ```

3. 在浏览器中打开：
   ```
   http://localhost:8000
   ```

### 使用说明

### 添加社团Logo

1. 将社团的Logo图片放在 `assets/logos/` 文件夹中
2. 推荐使用 PNG 格式（透明背景）
3. 建议尺寸：至少 160x160 像素（地图上显示尺寸）
4. 文件命名示例：`tsinghua-game-club.png`

### 添加社团数据

编辑 `data/clubs.json` 文件，添加新的社团信息，并提交PR：

```json
{
  "id": "club-xxx",
  "name": "社团名称",
  "school": "学校名称",
  "city": "城市",
  "province": "省份",
  "latitude": 纬度,
  "longitude": 经度,
  "logo_url": "assets/logos/your-logo.png",
  "short_description": "简短描述",
  "long_description": "详细描述",
  "external_links": [
    {
      "type": "website|social|email",
      "url": "链接地址"
    }
  ],
  "tags": ["标签1", "标签2"]
}
```
logo_url支持地路径或远程URL
### 侧边栏操作

- **展开侧边栏**：点击右上角的 ☰ 按钮
- **关闭侧边栏**：点击侧边栏右上角的 × 按钮，或按 `Esc` 键
- **查看详情**：点击地图上的社团标记，侧边栏会自动展开并显示详情
- **搜索社团**：在侧边栏顶部输入关键词进行搜索
- **按省份浏览**：点击省份标签查看该省份的所有社团

## 技术栈

- **地图库**：Leaflet.js
- **聚合插件**：Leaflet.markercluster
- **数据格式**：JSON
- **部署**：GitHub Pages

## 项目结构

```
GameDevMap/
├── index.html          # 主HTML文件
├── styles.css          # 样式文件
├── script.js           # JavaScript逻辑
├── assets/
│   └── logos/          # 社团Logo图片
└── data/
   └── clubs.json      # 社团数据
```

## 贡献指南

欢迎通过 Pull Request 添加新的社团信息或改进功能：

1. Fork 本仓库
2. 创建分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请创建 Issue 或通过邮件联系。
