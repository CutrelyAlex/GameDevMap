const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Club = require('../models/Club');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/tools/jsonToDB
 * 从 JSON 文件导入数据到 MongoDB
 */
router.post('/jsonToDB', authenticate, async (req, res) => {
  try {
    // 读取 JSON 文件
    const jsonPath = path.resolve(__dirname, '../../public/data/clubs.json');
    let jsonClubs = [];
    
    try {
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      jsonClubs = JSON.parse(jsonData);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'JSON_NOT_FOUND',
        message: 'clubs.json 文件不存在'
      });
    }

    let insertedCount = 0;
    let updatedCount = 0;

    // 逐个处理社团数据
    for (const club of jsonClubs) {
      try {
        const clubData = {
          name: club.name,
          school: club.school,
          province: club.province,
          city: club.city || '',
          coordinates: club.coordinates || [0, 0],
          description: club.description || '',
          shortDescription: club.shortDescription || '',
          tags: club.tags || [],
          logo: club.logo || '',
          externalLinks: (club.externalLinks || []).map(link => ({
            type: link.type,
            url: link.url
          }))
        };

        // 如果有 ID，尝试更新；否则插入新记录
        if (club.id) {
          const existing = await Club.findById(club.id);
          if (existing) {
            await Club.findByIdAndUpdate(club.id, clubData);
            updatedCount++;
          } else {
            clubData._id = club.id;
            await Club.create(clubData);
            insertedCount++;
          }
        } else {
          await Club.create(clubData);
          insertedCount++;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process club: ${club.name}`, error.message);
      }
    }

    return res.json({
      success: true,
      message: 'JSON → DB 导入完成',
      data: {
        total: insertedCount + updatedCount,
        inserted: insertedCount,
        updated: updatedCount,
        fromFile: jsonClubs.length
      }
    });

  } catch (error) {
    console.error('❌ JSON to DB failed:', error);
    return res.status(500).json({
      success: false,
      error: 'JSON_TO_DB_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/tools/migrateClubs
 * 执行数据库迁移脚本
 */
router.post('/migrateClubs', authenticate, async (req, res) => {
  try {
    // 动态导入迁移脚本
    const migratePath = path.resolve(__dirname, '../scripts/migrateClubs.js');
    
    // 检查文件是否存在
    try {
      await fs.access(migratePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'SCRIPT_NOT_FOUND',
        message: '迁移脚本不存在'
      });
    }

    // 执行迁移
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const result = await execAsync(`node "${migratePath}"`, {
      cwd: path.resolve(__dirname, '../..')
    });

    return res.json({
      success: true,
      message: '数据库迁移完成',
      data: {
        message: '迁移成功',
        output: result.stdout
      }
    });

  } catch (error) {
    console.error('❌ Migrate failed:', error);
    return res.status(500).json({
      success: false,
      error: 'MIGRATE_FAILED',
      message: error.message || '数据库迁移失败'
    });
  }
});

/**
 * POST /api/tools/cleanupLogos
 * 清理孤立的 Logo 文件
 */
router.post('/cleanupLogos', authenticate, async (req, res) => {
  try {
    // 导入清理脚本
    const { cleanupOrphanedLogos } = require('../scripts/cleanupOrphanedLogos');
    
    // 执行清理
    // 由于原脚本没有返回值，我们需要修改一下
    const projectRoot = path.resolve(__dirname, '../..');
    const Submission = require('../models/Submission');

    // 获取所有活跃的 Logo 文件名
    const [clubs, pendingSubmissions] = await Promise.all([
      Club.find({}, 'logo').lean(),
      Submission.find({ status: 'pending' }, 'data.logo').lean()
    ]);

    const activeLogos = new Set();

    // 收集俱乐部 Logo
    clubs.forEach(club => {
      if (club.logo) activeLogos.add(club.logo);
    });

    // 收集待审核提交的 Logo
    pendingSubmissions.forEach(submission => {
      if (submission.data && submission.data.logo) {
        activeLogos.add(submission.data.logo);
      }
    });

    // 清理目录
    const logosDir = path.join(projectRoot, 'public', 'assets', 'logos');
    const compressedLogosDir = path.join(projectRoot, 'public', 'assets', 'compressedLogos');

    let deletedCount = 0;

    // 清理 logos 目录
    try {
      const logoFiles = await fs.readdir(logosDir);
      for (const file of logoFiles) {
        if (!activeLogos.has(file)) {
          const filePath = path.join(logosDir, file);
          await fs.unlink(filePath);
          console.log(`删除孤立 Logo: ${file}`);
          deletedCount++;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`读取 logos 目录失败:`, error.message);
      }
    }

    // 清理 compressedLogos 目录
    try {
      const compressedLogoFiles = await fs.readdir(compressedLogosDir);
      for (const file of compressedLogoFiles) {
        if (!activeLogos.has(file)) {
          const filePath = path.join(compressedLogosDir, file);
          await fs.unlink(filePath);
          console.log(`删除孤立压缩 Logo: ${file}`);
          deletedCount++;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`读取 compressedLogos 目录失败:`, error.message);
      }
    }

    return res.json({
      success: true,
      message: '清理完成',
      data: {
        deletedCount,
        activeLogos: activeLogos.size
      }
    });

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return res.status(500).json({
      success: false,
      error: 'CLEANUP_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/tools/gitQuick
 * 快速 Git 操作
 */
router.post('/gitQuick', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_MESSAGE',
        message: '提交信息不能为空'
      });
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const projectRoot = path.resolve(__dirname, '../..');

    const steps = [];

    try {
      // 1. git add .
      console.log('🔄 Running: git add .');
      await execAsync('git add .', { cwd: projectRoot });
      steps.push('git add . ✓');
      
      // 2. git commit
      console.log(`🔄 Running: git commit -m "${message}"`);
      try {
        await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectRoot });
        steps.push(`git commit -m "${message}" ✓`);
      } catch (error) {
        if (error.stdout && error.stdout.includes('nothing to commit')) {
          steps.push('git commit (nothing to commit)');
        } else {
          throw error;
        }
      }
      
      // 3. git pull
      console.log('🔄 Running: git pull');
      await execAsync('git pull', { cwd: projectRoot });
      steps.push('git pull ✓');
      
      // 4. git push
      console.log('🔄 Running: git push');
      await execAsync('git push', { cwd: projectRoot });
      steps.push('git push ✓');

      return res.json({
        success: true,
        message: 'Git 操作完成',
        data: {
          steps
        }
      });

    } catch (error) {
      throw error;
    }

  } catch (error) {
    console.error('❌ Git quick failed:', error);
    return res.status(500).json({
      success: false,
      error: 'GIT_FAILED',
      message: error.message || 'Git 操作失败'
    });
  }
});

module.exports = router;
