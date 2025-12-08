/**
 * 重新初始化 index 字段脚本（完全覆写）
 * 功能：为所有 Club 文档重新分配 index 字段，按照名称字母顺序排序
 * 用法：node server/scripts/resetIndexField.js
 * 
 * 选项：
 *   --by-name: 按名称 (name) 排序 (默认)
 *   --by-school: 按学校 (school) 排序
 *   --by-creation: 按创建时间 (createdAt) 排序
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 导入 Club 模型
const Club = require('../models/Club');

// 数据库连接
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/game-dev-map', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB 已连接');
    return conn;
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message);
    process.exit(1);
  }
};

// 重新初始化 index 字段
const resetIndexField = async (sortBy = 'name') => {
  try {
    let sortOption = {};
    
    // 根据参数设置排序方式
    switch (sortBy) {
      case 'name':
        sortOption = { name: 1, school: 1 };
        console.log('📊 按社团名称排序重新分配 index...');
        break;
      case 'school':
        sortOption = { school: 1, name: 1 };
        console.log('📊 按所属学校排序重新分配 index...');
        break;
      case 'creation':
        sortOption = { createdAt: 1 };
        console.log('📊 按创建时间排序重新分配 index...');
        break;
      default:
        sortOption = { name: 1, school: 1 };
        console.log('📊 按社团名称排序重新分配 index...');
    }

    // 获取所有文档，按指定方式排序
    const clubs = await Club.find({}).sort(sortOption);
    
    if (clubs.length === 0) {
      console.log('⚠️  没有找到任何社团');
      return;
    }

    console.log(`\n📋 找到 ${clubs.length} 个社团\n`);

    // 重新分配 index
    for (let i = 0; i < clubs.length; i++) {
      clubs[i].index = i;
      await clubs[i].save();
      console.log(`✏️  ${i.toString().padStart(3)} - ${clubs[i].name} (${clubs[i].school})`);
    }

    console.log(`\n✅ 已成功重新分配 ${clubs.length} 个文档的 index 字段`);
  } catch (error) {
    console.error('❌ 重新初始化失败:', error.message);
    process.exit(1);
  }
};

// 验证 index 字段
const validateIndexField = async () => {
  try {
    const clubs = await Club.find({}).select('name school index').sort({ index: 1 });
    
    console.log('\n📋 验证 index 字段：');
    
    let isValid = true;
    
    for (let i = 0; i < clubs.length; i++) {
      if (clubs[i].index !== i) {
        console.error(`❌ 索引不连续: 位置 ${i} 的 index 值是 ${clubs[i].index}`);
        isValid = false;
      }
    }

    if (isValid) {
      console.log('✅ index 字段验证通过，所有值都正确连续');
    } else {
      console.warn('⚠️  index 字段存在问题');
    }
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  }
};

// 获取排序参数
const getSortOption = () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--by-school')) return 'school';
  if (args.includes('--by-creation')) return 'creation';
  
  return 'name'; // 默认按名称排序
};

// 主函数
const main = async () => {
  console.log('🚀 开始重新初始化 index 字段...\n');
  
  await connectDB();
  
  const sortBy = getSortOption();
  await resetIndexField(sortBy);
  await validateIndexField();
  
  console.log('\n✅ 脚本执行完成');
  process.exit(0);
};

// 执行脚本
main();
