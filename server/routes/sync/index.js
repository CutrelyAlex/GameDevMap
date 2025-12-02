/**
 * 同步模块 - 路由定义
 * 拆分自原 sync.js，辅助函数移至 helpers.js
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const Club = require('../../models/Club');
const { authenticate } = require('../../middleware/auth');
const { PROJECT_ROOT } = require('../../config/paths');
const {
  formatClub,
  readClubsJson,
  writeClubsJson,
  findDifferences,
  detectDuplicates,
  importClubToDb
} = require('./helpers');

/**
 * POST /api/sync/migrate-json-to-db - JSON 迁移到数据库
 */
router.post('/migrate-json-to-db', authenticate, async (req, res) => {
  try {
    const clubs = await readClubsJson();
    if (!clubs) {
      return res.status(404).json({ success: false, error: 'JSON_NOT_FOUND', message: 'clubs.json 文件不存在' });
    }

    console.log(`📄 Found ${clubs.length} clubs in clubs.json`);
    const deleteResult = await Club.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing clubs`);

    let imported = 0, skipped = 0;
    for (const club of clubs) {
      try {
        await importClubToDb(club);
        imported++;
        console.log(`  ✓ Imported: ${club.name} (${club.school})`);
      } catch (error) {
        console.error(`  ✗ Failed: ${club.name}:`, error.message);
        skipped++;
      }
    }

    const finalCount = await Club.countDocuments();
    return res.json({
      success: true,
      message: 'JSON → Database 迁移完成',
      data: { imported, skipped, totalInJson: clubs.length, totalInDb: finalCount }
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return res.status(500).json({ success: false, error: 'MIGRATION_FAILED', message: error.message });
  }
});

/**
 * GET /api/sync/compare - 对比数据库和 JSON
 */
router.get('/compare', authenticate, async (req, res) => {
  try {
    const dbClubs = await Club.find({}).lean();
    const jsonClubs = await readClubsJson();
    if (!jsonClubs) {
      return res.status(404).json({ success: false, error: 'JSON_NOT_FOUND', message: 'clubs.json 文件不存在' });
    }

    const dbMap = new Map();
    const result = { identical: [], different: [], dbOnly: [], jsonOnly: [], duplicates: [] };

    dbClubs.forEach(club => {
      const key = `${club.name.toLowerCase()}-${club.school.toLowerCase()}`;
      dbMap.set(key, { db: formatClub(club), mongoId: club._id });
    });

    jsonClubs.forEach(club => {
      const key = `${club.name.toLowerCase()}-${club.school.toLowerCase()}`;
      if (dbMap.has(key)) {
        dbMap.get(key).json = club;
      } else {
        result.jsonOnly.push(club);
      }
    });

    for (const [key, data] of dbMap) {
      if (data.json) {
        const diffs = findDifferences(data.db, data.json);
        if (diffs.length === 0) {
          result.identical.push({ club: data.db, source: 'both' });
        } else {
          result.different.push({ db: data.db, json: data.json, differences: diffs });
        }
      } else {
        result.dbOnly.push(data.db);
      }
    }

    result.duplicates = detectDuplicates(dbClubs, jsonClubs);

    return res.json({
      success: true,
      data: {
        stats: {
          database: { total: dbClubs.length, unique: dbMap.size },
          json: { total: jsonClubs.length },
          comparison: {
            identical: result.identical.length,
            different: result.different.length,
            dbOnly: result.dbOnly.length,
            jsonOnly: result.jsonOnly.length,
            duplicates: result.duplicates.length
          }
        },
        details: result
      }
    });
  } catch (error) {
    console.error('Compare failed:', error);
    return res.status(500).json({ success: false, error: 'COMPARE_FAILED', message: error.message });
  }
});

/**
 * POST /api/sync/replace - JSON 覆盖数据库
 */
router.post('/replace', authenticate, async (req, res) => {
  try {
    const clubs = await readClubsJson();
    if (!clubs) {
      return res.status(404).json({ success: false, error: 'JSON_NOT_FOUND', message: 'clubs.json 文件不存在' });
    }

    const deleteResult = await Club.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} clubs`);

    let imported = 0, skipped = 0;
    for (const club of clubs) {
      try {
        await importClubToDb(club);
        imported++;
      } catch (error) {
        skipped++;
      }
    }

    const finalCount = await Club.countDocuments();
    return res.json({
      success: true,
      message: '用 JSON 覆盖 Database 完成',
      data: { total: finalCount, imported, skipped }
    });
  } catch (error) {
    console.error('Replace failed:', error);
    return res.status(500).json({ success: false, error: 'REPLACE_FAILED', message: error.message });
  }
});

/**
 * POST /api/sync/overwrite-json - 数据库覆盖 JSON
 */
router.post('/overwrite-json', authenticate, async (req, res) => {
  try {
    const dbClubs = await Club.find({}).lean().sort({ index: 1, name: 1 });
    if (!dbClubs?.length) {
      return res.status(400).json({ success: false, error: 'NO_DATA', message: '数据库中没有任何社团' });
    }

    const formatted = dbClubs.map(formatClub);
    await writeClubsJson(formatted);

    return res.json({
      success: true,
      message: '成功用 Database 数据覆盖 JSON 文件',
      data: { total: formatted.length, action: 'Database → JSON' }
    });
  } catch (error) {
    console.error('Overwrite JSON error:', error);
    return res.status(500).json({ success: false, error: 'OVERWRITE_FAILED', message: error.message });
  }
});

/**
 * POST /api/sync/atomic-merge-json-to-db - 原子合并 JSON → DB
 */
router.post('/atomic-merge-json-to-db', authenticate, async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier?.includes('|')) {
      return res.status(400).json({ success: false, error: 'INVALID_IDENTIFIER', message: '无效的标识符格式' });
    }

    const [name, school] = identifier.split('|').map(s => s.trim());
    const clubs = await readClubsJson();
    const jsonClub = clubs?.find(c => c.name === name && c.school === school);
    if (!jsonClub) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: `在 JSON 中找不到: ${identifier}` });
    }

    let dbClub = await Club.findOne({ name, school });
    const action = dbClub ? '更新' : '创建';

    if (dbClub) {
      Object.assign(dbClub, {
        city: jsonClub.city || dbClub.city,
        province: jsonClub.province || dbClub.province,
        coordinates: jsonClub.coordinates || dbClub.coordinates,
        logo: jsonClub.logo || dbClub.logo,
        shortDescription: jsonClub.shortDescription || dbClub.shortDescription,
        description: jsonClub.description || dbClub.description,
        tags: jsonClub.tags || dbClub.tags,
        externalLinks: jsonClub.externalLinks || dbClub.externalLinks
      });
      await dbClub.save();
    } else {
      dbClub = await Club.create({
        name, school,
        city: jsonClub.city || '',
        province: jsonClub.province || '',
        coordinates: jsonClub.coordinates || [0, 0],
        logo: jsonClub.logo || '',
        shortDescription: jsonClub.shortDescription || '',
        description: jsonClub.description || '',
        tags: jsonClub.tags || [],
        externalLinks: jsonClub.externalLinks || [],
        index: await Club.countDocuments()
      });
    }

    return res.json({ success: true, message: `原子化合并成功: ${identifier}`, data: { action, club: { name, school } } });
  } catch (error) {
    console.error('Atomic merge error:', error);
    return res.status(500).json({ success: false, error: 'MERGE_FAILED', message: error.message });
  }
});

/**
 * POST /api/sync/atomic-merge-db-to-json - 原子合并 DB → JSON
 */
router.post('/atomic-merge-db-to-json', authenticate, async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier?.includes('|')) {
      return res.status(400).json({ success: false, error: 'INVALID_IDENTIFIER', message: '无效的标识符格式' });
    }

    const [name, school] = identifier.split('|').map(s => s.trim());
    const dbClub = await Club.findOne({ name, school });
    if (!dbClub) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: `在 Database 中找不到: ${identifier}` });
    }

    let clubs = await readClubsJson() || [];
    const existingIndex = clubs.findIndex(c => c.name === name && c.school === school);
    const formatted = formatClub(dbClub);
    const action = existingIndex >= 0 ? '更新' : '创建';

    if (existingIndex >= 0) {
      clubs[existingIndex] = formatted;
    } else {
      clubs.push(formatted);
    }

    // 按 index 排序
    const dbClubsForSort = await Club.find({}).lean().sort({ index: 1 });
    const indexMap = new Map(dbClubsForSort.map((c, i) => [`${c.name}|${c.school}`, i]));
    clubs.sort((a, b) => (indexMap.get(`${a.name}|${a.school}`) || 0) - (indexMap.get(`${b.name}|${b.school}`) || 0));

    await writeClubsJson(clubs);

    return res.json({ success: true, message: `原子化合并成功: ${identifier}`, data: { action, club: { name, school } } });
  } catch (error) {
    console.error('Atomic merge error:', error);
    return res.status(500).json({ success: false, error: 'MERGE_FAILED', message: error.message });
  }
});

/**
 * POST /api/sync/git-pull - 执行 git pull
 */
router.post('/git-pull', authenticate, async (req, res) => {
  try {
    console.log(`📥 [Git Pull] 用户 ${req.user.username} 执行 Git Pull`);
    const { stdout, stderr } = await execAsync('git pull', { cwd: PROJECT_ROOT });

    if (stderr?.includes('conflict')) {
      return res.status(409).json({ success: false, error: 'GIT_CONFLICT', message: `Git Pull 遭遇冲突：${stderr}` });
    }

    return res.status(200).json({ success: true, message: 'Git Pull 完成', data: { message: stdout.trim() || 'Already up to date' } });
  } catch (error) {
    console.error('Git Pull error:', error);
    return res.status(500).json({ success: false, error: 'GIT_PULL_FAILED', message: error.message });
  }
});

/**
 * POST /api/sync/git-push - 执行 git add + commit + push
 */
router.post('/git-push', authenticate, async (req, res) => {
  try {
    await execAsync('git add .', { cwd: PROJECT_ROOT });
    const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: PROJECT_ROOT });

    if (!statusOut.trim()) {
      return res.status(200).json({ success: true, message: '没有更改可提交', data: { message: 'Working directory is clean' } });
    }

    const commitDate = new Date().toISOString();
    await execAsync(`git commit -m "Auto commit: ${commitDate}"`, { cwd: PROJECT_ROOT });
    const { stdout, stderr } = await execAsync('git push', { cwd: PROJECT_ROOT });

    if (stderr?.includes('conflict') || stderr?.includes('rejected')) {
      return res.status(409).json({ success: false, error: 'GIT_CONFLICT', message: `Git Push 失败：${stderr}` });
    }

    return res.status(200).json({ success: true, message: 'Git 提交成功', data: { message: stdout.trim() || 'Pushed successfully' } });
  } catch (error) {
    console.error('Git Push error:', error);
    if (error.message?.includes('conflict') || error.message?.includes('rejected')) {
      return res.status(409).json({ success: false, error: 'GIT_CONFLICT', message: error.message });
    }
    return res.status(500).json({ success: false, error: 'GIT_PUSH_FAILED', message: error.message });
  }
});

module.exports = router;
