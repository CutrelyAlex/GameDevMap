# 缓存服务器使用指南

## 安装依赖

```bash
npm install
```

## 启动服务器

```bash
npm start
```

服务器将在端口 3000 运行（可通过 PORT 环境变量配置）。

## 预缓存地图

启动服务器后，在另一个终端运行：

```bash
npm run pre-cache
```

这将永久缓存所有社团位置的地图。

## 缓存管理

查看缓存统计：
```bash
npm run cache:stats
```

清空临时缓存（保留社团位置的永久缓存）：
```bash
npm run cache:clear
```

清空所有缓存（包括永久缓存）：
```bash
npm run cache:clear:all
```

## 配置

将 `server/.env.example` 复制为 `server/.env` 并修改：

- `CACHE_MAX_AGE`: 临时缓存过期时间，单位毫秒（默认：7天）
- `AMAP_KEY`: 高德地图 API 密钥
- `PORT`: 服务器端口（默认：3000）

## 缓存结构

- `map-cache/permanent/`: 社团位置地图（永不过期）
- `map-cache/temp/`: 用户请求的地图（根据 CACHE_MAX_AGE 过期）

## API 端点

- `GET /api/staticmap`: 缓存地图代理
- `GET /api/cache/stats`: 缓存统计信息
- `DELETE /api/cache/clear`: 清空缓存

## 生产环境部署

使用 PM2 或类似进程管理器：

```bash
pm2 start server/cache-server.js --name gamedevmap-cache
```

配置反向代理（nginx 示例）：

```nginx
location /api/staticmap {
    proxy_pass http://localhost:3000;
    proxy_cache_valid 200 7d;
}
```
