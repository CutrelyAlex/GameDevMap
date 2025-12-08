const fs = require('fs').promises;
const path = require('path');
const Club = require('../models/Club');
const Submission = require('../models/Submission');
require('dotenv').config();

/**
 * 清理孤立Logo文件的脚本
 * 删除不再被任何俱乐部或提交引用的Logo文件
 */
async function cleanupOrphanedLogos() {
  console.log('开始清理孤立Logo文件...');

  const projectRoot = path.resolve(__dirname, '../..');

  try {
    // 获取所有活跃的Logo文件名
    const [clubs, pendingSubmissions] = await Promise.all([
      Club.find({}, 'logo').lean(),
      Submission.find({ status: 'pending' }, 'data.logo').lean()
    ]);

    const activeLogos = new Set();

    // 收集俱乐部Logo
    clubs.forEach(club => {
      if (club.logo) activeLogos.add(club.logo);
    });

    // 收集待审核提交的Logo
    pendingSubmissions.forEach(submission => {
      if (submission.data && submission.data.logo) {
        activeLogos.add(submission.data.logo);
      }
    });

    console.log(`找到 ${activeLogos.size} 个活跃Logo文件`);

    // 检查logos目录
    const logosDir = path.join(projectRoot, 'public', 'assets', 'logos');
    const compressedLogosDir = path.join(projectRoot, 'public', 'assets', 'compressedLogos');

    let deletedCount = 0;

    // 清理logos目录
    try {
      const logoFiles = await fs.readdir(logosDir);
      for (const file of logoFiles) {
        if (!activeLogos.has(file)) {
          const filePath = path.join(logosDir, file);
          await fs.unlink(filePath);
          console.log(`删除孤立Logo: ${filePath}`);
          deletedCount++;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`读取logos目录失败:`, error.message);
      }
    }

    // 清理compressedLogos目录
    try {
      const compressedLogoFiles = await fs.readdir(compressedLogosDir);
      for (const file of compressedLogoFiles) {
        if (!activeLogos.has(file)) {
          const filePath = path.join(compressedLogosDir, file);
          await fs.unlink(filePath);
          console.log(`删除孤立压缩Logo: ${filePath}`);
          deletedCount++;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`读取compressedLogos目录失败:`, error.message);
      }
    }

    console.log(`清理完成，共删除 ${deletedCount} 个孤立Logo文件`);

  } catch (error) {
    console.error('清理孤立Logo文件失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const mongoose = require('mongoose');
  require('dotenv').config();

  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log('连接到数据库');
    await cleanupOrphanedLogos();
    process.exit(0);
  })
  .catch(error => {
    console.error('数据库连接失败:', error);
    process.exit(1);
  });
}

module.exports = { cleanupOrphanedLogos };