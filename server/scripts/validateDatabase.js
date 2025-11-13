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
    img_name: club.logo || club.img_name || '',
    short_description: club.shortDescription || club.short_description || '',
    long_description: club.description || club.long_description || '',
    tags: club.tags || [],
    external_links: normalizeLinks(club.external_links || [])
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
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      differences.push({
        field: key,
        database: val1,
        json: val2
      });
    }
  }
  
  return differences;
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
      conflicts: []
    };

    // 按名称比对
    for (const [key, data] of nameMap) {
      if (data.db && data.json) {
        if (data.db.id === data.json.id) {
          // ID相同，检查内容是否相同
          const dbStr = JSON.stringify(data.db);
          const jsonStr = JSON.stringify(data.json);
          
          if (dbStr === jsonStr) {
            result.identical.push({
              club: data.db,
              source: 'both'
            });
          } else {
            result.different.push({
              club: data.db.name,
              school: data.db.school,
              differences: findDifferences(data.db, data.json)
            });
          }
        } else {
          result.conflicts.push({
            name: data.db.name,
            school: data.db.school,
            dbId: data.db.id,
            jsonId: data.json.id,
            reason: 'Same name but different ID'
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
