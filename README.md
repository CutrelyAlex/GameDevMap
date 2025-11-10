# 全国高校游戏开发社团地图

- 一个用于展示和链接全国高校游戏开发社团的互动地图网站
- 目前部署于 8.163.12.243

## 快速开始

### 添加社团数据

- 编辑 `data/clubs.json` 文件，添加新的社团信息，并提交PR或者Issue（带图片）
- 如果你不知道如何添加，可联系作者QQ：2470819243

```
{
  "id": "club-en-name",
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
      "type": "链接将会显示的名称",
      "url": "链接地址"
    }
  ],
  "tags": ["标签1", "标签2"]
}
```
- logo_url支持地路径或远程URL
- 标签1填写：正式社团、非正式社团（如同好会、学生组织等）
- 标签2~n可以填写：技术内容(例如Unity、音乐等)
- 链接支持多个
### 贡献
欢迎通过 Pull Request 添加新的社团信息或改进功能：

1. Fork 本仓库
2. 创建分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request


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

### 侧边栏操作

- **展开侧边栏**：点击右上角的 ☰ 按钮
- **关闭侧边栏**：点击侧边栏右上角的 × 按钮，或按 `Esc` 键
- **查看详情**：点击地图上的社团标记，侧边栏会自动展开并显示详情
- **搜索社团**：在侧边栏顶部输入关键词进行搜索
- **按省份浏览**：点击省份标签查看该省份的所有社团

## ⚠️ 重要声明

### 免责声明

**本项目仅用于学术交流和信息共享目的。所有社团信息均由用户自行提交，本项目不对信息的准确性、真实性或合法性承担任何责任。**

### 注意事项

1. **社团类型标识**：
   - 请在标签中明确标识社团类型：`正式社团` 或 `非正式社团`
   - 非正式社团包括同好会、学生组织、兴趣小组等
   - 正式社团是指学校书面承认的，由校团委或校社联组织管理的社团/工作室等组织

2. **学校政策**：不同学校对社团的宣传政策可能不同，建议咨询学校相关部门了解相关规定

**特别提醒：本项目不对任何因使用本网站信息而产生的后果承担责任。请用户自行判断和承担风险。**

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


## 许可证

MIT License

## 联系方式

如有问题或建议，请创建 Issue 或通过邮件联系。
