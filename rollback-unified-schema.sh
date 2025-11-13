#!/bin/bash
#
# 统一模式回滚脚本
# 从备份恢复数据到迁移前的状态
#
# 用法: ./rollback-unified-schema.sh [BACKUP_PATH]
# 示例: ./rollback-unified-schema.sh
#       ./rollback-unified-schema.sh backups/pre-unified-20240115-143022
#

set -e

# 配置
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/gamedevmap}"
PM2_APP_NAME="gamedevmap-api"
BACKUP_PATH="$1"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 标题
echo ""
echo -e "${RED}$(printf '=%.0s' {1..60})${NC}"
echo -e "${YELLOW}  统一模式回滚脚本${NC}"
echo -e "${RED}$(printf '=%.0s' {1..60})${NC}"
echo ""

# 查找备份目录
if [ -z "$BACKUP_PATH" ]; then
    # 使用最新的备份
    BACKUP_PATH=$(ls -td backups/pre-unified-* 2>/dev/null | head -1)
    
    if [ -z "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ 未找到备份目录！${NC}"
        exit 1
    fi
    
    echo -e "${CYAN}📁 使用最新备份: $(basename $BACKUP_PATH)${NC}"
fi

if [ ! -d "$BACKUP_PATH" ]; then
    echo -e "${RED}❌ 备份目录不存在: $BACKUP_PATH${NC}"
    exit 1
fi

# 确认回滚
echo ""
echo -e "${YELLOW}⚠️  警告：此操作将恢复到迁移前的状态！${NC}"
echo -e "${YELLOW}   - 会覆盖当前 clubs.json${NC}"
echo -e "${YELLOW}   - 会恢复 MongoDB 数据${NC}"
echo ""
read -p "确认继续？(输入 YES 确认): " confirm
if [ "$confirm" != "YES" ]; then
    echo -e "${RED}❌ 已取消回滚${NC}"
    exit 0
fi

echo ""

# 1. 恢复 clubs.json
echo -e "${CYAN}[1/3] 📦 恢复 clubs.json...${NC}"
if [ -f "$BACKUP_PATH/clubs.json.backup" ]; then
    cp "$BACKUP_PATH/clubs.json.backup" "public/data/clubs.json"
    echo -e "${GREEN}   ✓ clubs.json 已恢复${NC}"
else
    echo -e "${YELLOW}   ⚠ 未找到 clubs.json 备份${NC}"
fi
echo ""

# 2. 恢复 MongoDB
echo -e "${CYAN}[2/3] 🔄 恢复 MongoDB...${NC}"
if [ -d "$BACKUP_PATH/mongodb" ]; then
    if command -v mongorestore &> /dev/null; then
        if mongorestore --uri="$MONGODB_URI" --drop "$BACKUP_PATH/mongodb" 2>/dev/null; then
            echo -e "${GREEN}   ✓ MongoDB 已恢复${NC}"
        else
            echo -e "${YELLOW}   ⚠ MongoDB 恢复失败${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠ mongorestore 未安装${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠ 未找到 MongoDB 备份${NC}"
fi
echo ""

# 3. 重启服务
echo -e "${CYAN}[3/3] 🔄 重启服务...${NC}"
if pm2 restart "$PM2_APP_NAME" > /dev/null 2>&1; then
    echo -e "${GREEN}   ✓ 服务已重启${NC}"
else
    echo -e "${YELLOW}   ⚠ 重启失败，请手动检查${NC}"
fi

echo ""
echo -e "${RED}$(printf '=%.0s' {1..60})${NC}"
echo -e "${GREEN}  ✅ 回滚完成！${NC}"
echo -e "${RED}$(printf '=%.0s' {1..60})${NC}"
echo ""
echo -e "${CYAN}📋 已从备份恢复: $BACKUP_PATH${NC}"
echo ""
