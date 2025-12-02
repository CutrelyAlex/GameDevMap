#!/usr/bin/env node

/**
 * 验证脚本：检查数据库和 JSON 文件数据一致性
 * 
 * 基于 /api/sync/compare 端点的逻辑，但为命令行使用优化
 * 用法：npm run validate:db
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const Club = require('../models/Club');

/**
 * 格式化俱乐部数据为可比较的格式
 */
function formatClub(club) {
  return {
    id: club._id ? club._id.toString() : club.id,
    name: club.name,
    school: club.school,
    city: club.city || '',
    province: club.province,
    latitude: club.coordinates ? club.coordinates[1] : club.latitude,
    longitude: club.coordinates ? club.coordinates[0] : club.longitude,
    logo: club.logo || '',
    shortDescription: club.shortDescription || '',
    description: club.description || '',
    tags: club.tags || [],
    externalLinks: normalizeLinks(club.externalLinks || [])
  };
}

/**
 * 规范化外部链接（移除 MongoDB 自动生成的 _id）
 */
function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.map(link => ({
    type: link.type,
    url: link.url
  }));
}

/**
 * 找出两个对象之间的差异
 */
function findDifferences(obj1, obj2) {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
    // 跳过 ID 字段的比较，因为 DB ID 是 MongoDB 生成的 _id，JSON ID 是手动的
    if (key === 'id' || key === '_id' || key === 'dbId' || key === 'jsonId') {
      continue;
    }
    
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    // 清理对象，移除所有 _id 字段以进行比较
    const cleanVal1 = removeIds(val1);
    const cleanVal2 = removeIds(val2);
    
    if (JSON.stringify(cleanVal1) !== JSON.stringify(cleanVal2)) {
      differences.push({
        field: key,
        database: val1,
        json: val2
      });
    }
  }
  
  return differences;
}

/**
 * 递归移除对象中的所有 _id 字段
 */
function removeIds(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeIds(item));
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key !== '_id') {
      cleaned[key] = removeIds(value);
    }
  }
  
  return cleaned;
}

async function validateDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 读取 clubs.json
    const clubsJsonPath = path.join(__dirname, '../../public/data/clubs.json');
    const jsonData = await fs.readFile(clubsJsonPath, 'utf8');
    const jsonClubs = JSON.parse(jsonData);

    // 读取 MongoDB 数据
    const dbClubs = await Club.find({}).lean();

    console.log('📊 Database Validation Report');
    console.log('='.repeat(70));

    // 创建映射表
    const dbMap = new Map();
    const jsonMap = new Map();
    const nameMap = new Map();

    dbClubs.forEach(club => {
      const formatted = formatClub(club);
      dbMap.set(formatted.id, formatted);
      const key = `${formatted.name.toLowerCase()}-${formatted.school.toLowerCase()}`;
      nameMap.set(key, { db: formatted });
    });

    jsonClubs.forEach(club => {
      jsonMap.set(club.id, club);
      const key = `${club.name.toLowerCase()}-${club.school.toLowerCase()}`;
      if (nameMap.has(key)) {
        nameMap.get(key).json = club;
      } else {
        nameMap.set(key, { json: club });
      }
    });

    // 分类结果
    const result = {
      identical: [],
      different: [],
      dbOnly: [],
      jsonOnly: [],
      conflicts: [] // 保留用于兼容性，但在新版本中不会被填充
    };

    // 按名称比对
    for (const [key, data] of nameMap) {
      if (data.db && data.json) {
        // 注意：DB ID 是 MongoDB 新生成的 _id，JSON ID 是旧的
        // 所以不应该比较 ID，而是按名称+学校匹配后比较其他字段
        
        // 创建用于比较的副本，移除ID字段
        const dbForComparison = { ...data.db };
        const jsonForComparison = { ...data.json };
        delete dbForComparison.id;
        delete jsonForComparison.id;
        
        const dbStr = JSON.stringify(dbForComparison);
        const jsonStr = JSON.stringify(jsonForComparison);
        
        if (dbStr === jsonStr) {
          result.identical.push({
            club: data.db,
            source: 'both',
            note: `DB ID: ${data.db.id}, JSON ID: ${data.json.id}`
          });
        } else {
          result.different.push({
            club: data.db.name,
            school: data.db.school,
            dbId: data.db.id,
            jsonId: data.json.id,
            differences: findDifferences(data.db, data.json)
          });
        }
      } else if (data.db && !data.json) {
        result.dbOnly.push({
          name: data.db.name,
          school: data.db.school,
          id: data.db.id
        });
      } else if (!data.db && data.json) {
        result.jsonOnly.push({
          name: data.json.name,
          school: data.json.school,
          id: data.json.id
        });
      }
    }

    // 统计信息
    const stats = {
      database: {
        total: dbClubs.length,
        unique: dbMap.size
      },
      json: {
        total: jsonClubs.length,
        unique: jsonMap.size
      },
      comparison: {
        identical: result.identical.length,
        different: result.different.length,
        dbOnly: result.dbOnly.length,
        jsonOnly: result.jsonOnly.length,
        conflicts: result.conflicts.length
      }
    };

    // 输出结果
    console.log(`Database: ${stats.database.total} clubs`);
    console.log(`JSON: ${stats.json.total} clubs`);
    console.log('');

    if (result.identical.length > 0) {
      console.log(`✅ Identical: ${result.identical.length} clubs`);
    }

    if (result.different.length > 0) {
      console.log(`\n⚠️  Different: ${result.different.length} clubs`);
      result.different.forEach(diff => {
        console.log(`  \n❌ ${diff.club} (${diff.school})`);
        console.log(`     DB ID: ${diff.dbId}, JSON ID: ${diff.jsonId}`);
        diff.differences.forEach(d => {
          console.log(`     Field: ${d.field}`);
          console.log(`       DB:   ${JSON.stringify(d.database)}`);
          console.log(`       JSON: ${JSON.stringify(d.json)}`);
        });
      });
    }

    if (result.dbOnly.length > 0) {
      console.log(`\n🗑️  Only in DB: ${result.dbOnly.length} clubs`);
      result.dbOnly.forEach(club => {
        console.log(`  - ${club.name} (${club.school})`);
      });
    }

    if (result.jsonOnly.length > 0) {
      console.log(`\n📄 Only in JSON: ${result.jsonOnly.length} clubs`);
      result.jsonOnly.forEach(club => {
        console.log(`  - ${club.name} (${club.school})`);
      });
    }

    if (result.conflicts.length > 0) {
      console.log(`\n⚡ Conflicts: ${result.conflicts.length} clubs`);
      result.conflicts.forEach(conf => {
        console.log(`  - ${conf.name} (${conf.school})`);
        console.log(`    DB ID: ${conf.dbId}, JSON ID: ${conf.jsonId}`);
        console.log(`    ${conf.reason}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('Summary:');
    console.log(`  ✅ Identical: ${stats.comparison.identical}`);
    console.log(`  ⚠️  Different: ${stats.comparison.different}`);
    console.log(`  🗑️  DB Only: ${stats.comparison.dbOnly}`);
    console.log(`  📄 JSON Only: ${stats.comparison.jsonOnly}`);
    console.log(`  ⚡ Conflicts: ${stats.comparison.conflicts}`);
    console.log('='.repeat(70));

    const hasIssues = result.different.length > 0 || 
                      result.dbOnly.length > 0 || 
                      result.jsonOnly.length > 0 || 
                      result.conflicts.length > 0;

    if (hasIssues) {
      console.log('\n❌ Issues found! Run: npm run migrate:clubs');
      await mongoose.disconnect();
      process.exit(1);
    } else {
      console.log('\n✅ All data is consistent!');
      await mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  validateDatabase();
}

module.exports = validateDatabase;
