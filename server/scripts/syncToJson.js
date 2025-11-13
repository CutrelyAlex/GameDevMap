const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Club = require('../models/Club');

/**
 * Sync Script: MongoDB -> clubs.json
 * 
 * 从 MongoDB 导出所有社团到 public/data/clubs.json
 * 支持多种同步模式以适配不同的使用场景
 * 
 * 同步模式：
 * - replace: 完全替换（默认）- 用数据库内容完全覆盖 JSON
 * - merge: 智能合并 - 保留 JSON 中的手动修改，更新数据库中存在的记录
 * - update: 仅更新 - 只更新 JSON 中已存在的记录，不添加新记录
 * - addOnly: 仅添加 - 只添加 JSON 中不存在的新记录
 */

/**
 * 转换 Club 对象为 JSON 格式（统一为驼峰命名约定）
 */
function formatClubForJson(club) {
  // 处理外部链接，移除 _id 字段
  let externalLinks = [];
  if (club.externalLinks && Array.isArray(club.externalLinks)) {
    externalLinks = club.externalLinks.map(link => ({
      type: link.type,
      url: link.url
    }));
  }

  return {
    id: club._id.toString(),
    name: club.name,
    school: club.school,
    city: club.city || '',
    province: club.province,
    coordinates: club.coordinates || [0, 0],
    logo: club.logo || '',
    shortDescription: club.shortDescription || '',
    description: club.description || '',
    tags: club.tags || [],
    externalLinks: externalLinks
  };
}

/**
 * 完全替换模式（默认）
 */
async function syncReplace(clubs, clubsJsonPath) {
  const formattedClubs = clubs.map(formatClubForJson);
  
  await fs.writeFile(
    clubsJsonPath,
    JSON.stringify(formattedClubs, null, 2),
    'utf8'
  );

  return {
    mode: 'replace',
    total: formattedClubs.length,
    added: formattedClubs.length,
    updated: 0,
    removed: 0,
    unchanged: 0
  };
}

/**
 * 智能合并模式
 */
async function syncMerge(clubs, clubsJsonPath) {
  let existingClubs = [];
  
  try {
    const data = await fs.readFile(clubsJsonPath, 'utf8');
    existingClubs = JSON.parse(data);
  } catch (error) {
    console.log('ℹ️  No existing clubs.json, will create new');
  }

  const existingMap = new Map();
  existingClubs.forEach(club => {
    existingMap.set(club.id, club);
  });

  const dbMap = new Map();
  clubs.forEach(club => {
    const id = club._id.toString();
    dbMap.set(id, club);
  });

  const result = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let preserved = 0;

  // Process all clubs from database
  for (const club of clubs) {
    const id = club._id.toString();
    const formattedClub = formatClubForJson(club);
    
    if (existingMap.has(id)) {
      const existing = existingMap.get(id);
      const merged = {
        ...existing,
        ...formattedClub
      };
      
      if (JSON.stringify(existing) !== JSON.stringify(merged)) {
        updated++;
      } else {
        unchanged++;
      }
      
      result.push(merged);
    } else {
      result.push(formattedClub);
      added++;
    }
  }

  // Preserve clubs that exist in JSON but not in database
  for (const existing of existingClubs) {
    if (!dbMap.has(existing.id)) {
      result.push(existing);
      preserved++;
      console.log(`⚠️  Preserved club from JSON (not in DB): ${existing.name} (${existing.school})`);
    }
  }

  await fs.writeFile(
    clubsJsonPath,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  return {
    mode: 'merge',
    total: result.length,
    added,
    updated,
    preserved,
    unchanged
  };
}

/**
 * 仅更新模式
 */
async function syncUpdate(clubs, clubsJsonPath) {
  let existingClubs = [];
  
  try {
    const data = await fs.readFile(clubsJsonPath, 'utf8');
    existingClubs = JSON.parse(data);
  } catch (error) {
    throw new Error('clubs.json not found. Use "replace" or "merge" mode first.');
  }

  const dbMap = new Map();
  clubs.forEach(club => {
    const id = club._id.toString();
    dbMap.set(id, club);
  });

  const result = [];
  let updated = 0;
  let unchanged = 0;

  for (const existing of existingClubs) {
    if (dbMap.has(existing.id)) {
      const dbClub = dbMap.get(existing.id);
      const formattedClub = formatClubForJson(dbClub);
      
      if (JSON.stringify(existing) !== JSON.stringify(formattedClub)) {
        result.push(formattedClub);
        updated++;
      } else {
        result.push(existing);
        unchanged++;
      }
    } else {
      result.push(existing);
      unchanged++;
    }
  }

  await fs.writeFile(
    clubsJsonPath,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  return {
    mode: 'update',
    total: result.length,
    added: 0,
    updated,
    removed: 0,
    unchanged
  };
}

/**
 * 仅添加模式
 */
async function syncAddOnly(clubs, clubsJsonPath) {
  let existingClubs = [];
  
  try {
    const data = await fs.readFile(clubsJsonPath, 'utf8');
    existingClubs = JSON.parse(data);
  } catch (error) {
    console.log('ℹ️  No existing clubs.json, will create new');
  }

  const existingIds = new Set(existingClubs.map(c => c.id));
  const result = [...existingClubs];
  let added = 0;

  for (const club of clubs) {
    const id = club._id.toString();
    if (!existingIds.has(id)) {
      result.push(formatClubForJson(club));
      added++;
    }
  }

  await fs.writeFile(
    clubsJsonPath,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  return {
    mode: 'addOnly',
    total: result.length,
    added,
    updated: 0,
    removed: 0,
    unchanged: existingClubs.length
  };
}

/**
 * 主同步函数
 */
async function syncToJson(mode = 'replace') {
  try {
    const validModes = ['replace', 'merge', 'update', 'addOnly'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid sync mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
    }

    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  MongoDB not connected, attempting to connect...');
      await mongoose.connect(process.env.MONGODB_URI);
    }

    console.log(`🔄 Starting sync in ${mode.toUpperCase()} mode...`);

    const clubs = await Club.find({}).sort({ createdAt: -1 }).lean();
    console.log(`📊 Found ${clubs.length} clubs in MongoDB`);

    const clubsJsonPath = path.join(__dirname, '../../public/data/clubs.json');
    
    try {
      const backupPath = path.join(__dirname, '../../public/data/clubs.json.backup');
      await fs.copyFile(clubsJsonPath, backupPath);
      console.log('✓ Backup created: clubs.json.backup');
    } catch (error) {
      console.log('ℹ️  No existing clubs.json to backup');
    }

    let stats;
    switch (mode) {
      case 'replace':
        stats = await syncReplace(clubs, clubsJsonPath);
        break;
      case 'merge':
        stats = await syncMerge(clubs, clubsJsonPath);
        break;
      case 'update':
        stats = await syncUpdate(clubs, clubsJsonPath);
        break;
      case 'addOnly':
        stats = await syncAddOnly(clubs, clubsJsonPath);
        break;
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Successfully synced to clubs.json');
    console.log(`📊 Sync Statistics (${stats.mode.toUpperCase()} mode):`);
    console.log(`   📝 Total clubs: ${stats.total}`);
    console.log(`   ✅ Added: ${stats.added}`);
    console.log(`   ↻  Updated: ${stats.updated}`);
    if (stats.preserved !== undefined) {
      console.log(`   � Preserved (JSON only): ${stats.preserved}`);
    }
    if (stats.removed !== undefined) {
      console.log(`   �🗑️  Removed: ${stats.removed}`);
    }
    console.log(`   ━  Unchanged: ${stats.unchanged}`);
    console.log('='.repeat(60));

    return { 
      success: true, 
      ...stats
    };

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

if (require.main === module) {
  const mode = process.argv[2] || 'replace';
  
  console.log(`\n📋 Available modes: replace, merge, update, addOnly`);
  console.log(`📌 Using mode: ${mode}\n`);
  
  syncToJson(mode)
    .then((result) => {
      console.log('\n✅ Sync complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Sync failed:', error);
      process.exit(1);
    });
}

module.exports = syncToJson;