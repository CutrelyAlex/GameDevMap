#!/bin/bash
#
# 统一模式部署脚本
# 执行以下操作：
# 1. 备份现有数据
# 2. 运行数据迁移脚本
# 3. 重启 PM2 服务
# 4. 验证服务状态
# 5. 测试 API 端点
#
# 用法: ./deploy-unified-schema.sh [options]
# 选项:
#   --skip-backup    跳过备份步骤
#   --skip-restart   跳过重启步骤
#

set -e

# 配置
SKIP_BACKUP=false
SKIP_RESTART=false
BACKUP_DIR="backups/pre-unified-$(date +%Y%m%d-%H%M%S)"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/gamedevmap}"
PM2_APP_NAME="gamedevmap-api"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-restart)
            SKIP_RESTART=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# 标题
echo ""
echo -e "${CYAN}$(printf '=%.0s' {1..60})${NC}"
echo -e "${YELLOW}  统一模式部署脚本${NC}"
echo -e "${CYAN}$(printf '=%.0s' {1..60})${NC}"
echo ""

# 1. 备份数据
if [ "$SKIP_BACKUP" = false ]; then
    echo -e "${CYAN}[1/6] 📦 备份数据...${NC}"
    
    mkdir -p "$BACKUP_DIR"
    
    # 备份 clubs.json
    if [ -f "public/data/clubs.json" ]; then
        cp "public/data/clubs.json" "$BACKUP_DIR/clubs.json.backup"
        echo -e "${GREEN}   ✓ clubs.json 已备份${NC}"
    fi
    
    # 导出 MongoDB 数据
    echo -e "${YELLOW}   ⏳ 导出 MongoDB 数据...${NC}"
    if command -v mongodump &> /dev/null; then
        mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongodb" 2>/dev/null || true
        if [ -d "$BACKUP_DIR/mongodb" ]; then
            echo -e "${GREEN}   ✓ MongoDB 已备份到 $BACKUP_DIR/mongodb${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠ mongodump 未安装，跳过 MongoDB 备份${NC}"
    fi
    
    echo ""
fi

# 2. 运行迁移脚本
echo -e "${CYAN}[2/6] 🔄 执行数据迁移...${NC}"
if ! node scripts/migrate-to-unified-schema.js; then
    echo -e "${RED}❌ 迁移失败！请检查错误信息。${NC}"
    exit 1
fi
echo ""

# 3. 验证语法
echo -e "${CYAN}[3/6] 🔍 验证代码语法...${NC}"
files_to_check=(
    "server/models/Club.js"
    "server/models/Submission.js"
    "server/middleware/validate.js"
    "server/routes/submissions.js"
    "server/routes/sync.js"
    "public/js/submit.js"
)

for file in "${files_to_check[@]}"; do
    if node -c "$file" 2>/dev/null; then
        echo -e "${GREEN}   ✓ $file${NC}"
    else
        echo -e "${RED}   ✗ $file 语法错误！${NC}"
        exit 1
    fi
done
echo ""

# 4. 重启服务
if [ "$SKIP_RESTART" = false ]; then
    echo -e "${CYAN}[4/6] 🔄 重启 PM2 服务...${NC}"
    
    if pm2 restart "$PM2_APP_NAME" > /dev/null 2>&1; then
        echo -e "${GREEN}   ✓ 服务已重启${NC}"
    else
        echo -e "${YELLOW}   ⚠ PM2 重启失败，尝试手动启动...${NC}"
        pm2 start ecosystem.config.js || true
    fi
    
    echo -e "${YELLOW}   ⏳ 等待服务启动...${NC}"
    sleep 3
    echo ""
fi

# 5. 检查服务状态
echo -e "${CYAN}[5/6] 📊 检查服务状态...${NC}"
pm2 list | grep -A 1 "gamedevmap" || echo -e "${YELLOW}   ⚠ 未找到 PM2 进程${NC}"
echo ""

# 6. 测试 API 端点
echo -e "${CYAN}[6/6] 🧪 测试 API 端点...${NC}"
if command -v curl &> /dev/null; then
    if response=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/clubs 2>/dev/null); then
        http_code=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}   ✓ API 端点正常响应${NC}"
            
            # 尝试解析 JSON
            if echo "$body" | grep -q '"success".*true'; then
                echo -e "${GREEN}   ✓ 返回数据格式正确${NC}"
                
                # 获取社团数量
                total=$(echo "$body" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
                if [ ! -z "$total" ]; then
                    echo -e "${CYAN}   📊 社团数量: $total${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}   ⚠ API 返回非 200 状态码: $http_code${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠ 无法连接到 API${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠ curl 未安装，跳过 API 测试${NC}"
fi

echo ""
echo -e "${CYAN}$(printf '=%.0s' {1..60})${NC}"
echo -e "${GREEN}  ✅ 部署完成！${NC}"
echo -e "${CYAN}$(printf '=%.0s' {1..60})${NC}"
echo ""
echo -e "${YELLOW}📋 后续步骤：${NC}"
echo -e "   1. 检查 PM2 日志: pm2 logs $PM2_APP_NAME"
echo -e "   2. 测试提交功能: http://localhost/submit.html"
echo -e "   3. 测试管理后台: http://localhost/admin/"
echo -e "   4. 运行验证脚本: node debug-diff-fixed.js"
echo ""

# 显示备份位置
if [ "$SKIP_BACKUP" = false ]; then
    echo -e "${CYAN}💾 备份位置: $BACKUP_DIR${NC}"
    echo ""
fi
