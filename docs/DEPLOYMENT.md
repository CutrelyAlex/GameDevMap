# 生产环境部署指南

## 🚀 快速部署

### 1. 拉取最新代码
```bash
cd /home/www/GameDevMap
git pull origin main
```

### 2. 安装新依赖（如果有）
```bash
npm install
```

### 3. 运行数据迁移
初次部署或更新现有数据时运行：

```bash
# 将 clubs.json 导入到 MongoDB
npm run migrate:clubs
```

输出示例：
```
✅ Connected to MongoDB
📄 Found 100 clubs in clubs.json
  ✓ Imported: 厦门大学第九艺术游创社 (厦门大学)
  ✓ Imported: 萌屋 (湘潭大学)
  ...
📊 Migration Summary:
  ✓ Imported: 95
  ↻ Updated: 5
  ✗ Skipped: 0
  Total: 100
✅ Migration complete
```

### 4. 重启应用
```bash
pm2 restart gamedevmap-api
```

### 5. 验证部署
```bash
# 检查API是否正常
curl http://localhost:3001/api/clubs | jq '.data | length'

# 检查应用状态
pm2 logs gamedevmap-api --lines 20
```

---

### 🔧 配置要求
确保 `.env` 文件包含以下配置：

```env
# MongoDB连接
MONGODB_URI=mongodb://localhost:27017/gamedevmap

# 其他配置
PORT=3001
NODE_ENV=production
JWT_SECRET=your_jwt_secret
```

---

## 🔄 数据同步工作流

### 场景1: 通过管理后台添加社团
```
用户提交 → 管理员审批 → 自动写入MongoDB → 自动同步到clubs.json
```

### 场景2: 通过GitHub PR更新clubs.json
```bash
# 1. 合并PR后，在服务器上拉取最新代码
cd /home/www/GameDevMap
git pull origin main

# 2. 运行迁移命令
npm run migrate:clubs

# 3. 重启应用
pm2 restart gamedevmap-api
```

### 场景3: 手动同步数据库到JSON
```bash
# 导出MongoDB数据到clubs.json
npm run sync:json

# 提交更新
git add public/data/clubs.json
git commit -m "Update clubs.json from database"
git push origin main
```

---

## 🧪 测试验证

### 1. 测试API端点
```bash
# 获取所有社团
curl http://localhost:3001/api/clubs

# 获取单个社团
curl http://localhost:3001/api/clubs/<club_id>
```

预期响应：
```json
{
  "success": true,
  "data": [...],
  "total": 100
}
```

### 2. 测试前端加载
```bash
# 访问主页，检查浏览器控制台
# 应该看到：✓ Loaded 100 clubs
```

### 3. 测试提交和审批流程
1. 提交新社团：`http://your-domain.com/submit.html`
2. 登录管理后台：`http://your-domain.com/admin`
3. 批准提交
4. 检查：
   - MongoDB中是否有新记录：`db.clubs.count()`
   - clubs.json是否更新：`git diff public/data/clubs.json`
   - 前端地图是否显示新社团

### 4. 测试增强验证
提交一个社团，在管理后台查看：
- ⚠️ 黄色警告：检测到类似社团
- 距离偏差：显示实际距离

---

## 🐛 故障排查

### 问题1: API返回空数据
```bash
# 检查数据库
mongo gamedevmap
> db.clubs.count()

# 如果为0，运行迁移
npm run migrate:clubs
```

### 问题2: 前端显示旧数据
```bash
# 清除浏览器缓存
# 或强制刷新：Ctrl + Shift + R

# 检查API是否返回最新数据
curl http://localhost:3001/api/clubs | jq '.total'
```

### 问题3: 同步失败
```bash
# 检查日志
pm2 logs gamedevmap-api --err

# 手动运行同步脚本查看错误
node server/scripts/syncToJson.js
```

### 问题4: MongoDB 启动失败
**错误信息**:
```bash
systemctl start mongodb
# Job for mongodb.service failed because the control process exited with error code.
# See "systemctl status mongodb.service" and "journalctl -xe" for details.
```

**排查步骤**:

1. **查看详细错误**:
```bash
systemctl status mongodb.service
journalctl -xe | grep mongodb
```

2. **常见原因与解决方案**:

**a) 端口被占用**:
```bash
# 检查 27017 端口
netstat -tlnp | grep 27017
# 或
lsof -i :27017

# 如果被占用，杀死进程
kill -9 <PID>

# 重启 MongoDB
systemctl start mongodb
```

**b) 数据目录权限问题**:
```bash
# 检查数据目录所有权
ls -la /var/lib/mongodb/

# 修正权限
chown -R mongodb:mongodb /var/lib/mongodb
chmod 755 /var/lib/mongodb

# 重启
systemctl start mongodb
```

**c) 配置文件错误**:
```bash
# 检查配置文件语法
cat /etc/mongod.conf

# 常见问题：YAML 缩进错误
# 确保使用空格而非 Tab
# 确保冒号后有空格

# 恢复默认配置（如果改坏了）
cp /etc/mongod.conf /etc/mongod.conf.backup
# 从宝塔面板重新生成或手动编辑
```

**d) 日志文件权限**:
```bash
# 检查日志目录
ls -la /var/log/mongodb/

# 修正权限
chown -R mongodb:mongodb /var/log/mongodb
chmod 755 /var/log/mongodb

# 如果日志文件损坏，重命名
mv /var/log/mongodb/mongod.log /var/log/mongodb/mongod.log.old

# 重启
systemctl start mongodb
```

**e) 磁盘空间不足**:
```bash
# 检查磁盘使用率
df -h

# 如果 /var 分区满了，清理空间
# 清理日志
journalctl --vacuum-time=7d

# 清理 MongoDB 日志
rm /var/log/mongodb/*.log.old

# 重启
systemctl start mongodb
```

**f) 之前的实例未完全关闭**:
```bash
# 查找 MongoDB 进程
ps aux | grep mongod

# 强制终止所有 mongod 进程
pkill -9 mongod

# 删除锁文件
rm -f /var/lib/mongodb/mongod.lock

# 修复数据库（如果需要）
mongod --dbpath /var/lib/mongodb --repair

# 重启
systemctl start mongodb
```

**g) 宝塔面板特殊处理**:
```bash
# 如果通过宝塔安装，使用宝塔命令
/etc/init.d/mongodb start

# 或通过宝塔面板
# 软件商店 → MongoDB → 重启

# 查看宝塔 MongoDB 日志
tail -f /www/server/mongodb/log/config.log
```

3. **验证修复**:
```bash
# 检查状态
systemctl status mongodb

# 应该看到 Active: active (running)

# 测试连接
mongosh --eval "db.adminCommand('ping')"

# 应该返回: { ok: 1 }
```

4. **设置开机自启**（修复后）:
```bash
systemctl enable mongodb

# 验证
systemctl is-enabled mongodb
# 应该返回: enabled
```

---

## 📊 监控指标

### 关键日志
```bash
# 实时监控
pm2 logs gamedevmap-api --follow

# 查看最近的同步
pm2 logs gamedevmap-api | grep "sync"

# 查看批准操作
pm2 logs gamedevmap-api | grep "approved"
```

### 数据一致性检查
```bash
# 比较数据库和JSON文件的记录数
mongo gamedevmap --eval "db.clubs.count()"
cat public/data/clubs.json | jq 'length'
```
