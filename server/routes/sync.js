const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Club = require('../models/Club');
const { authenticate, authenticateGitOperations } = require('../middleware/auth');
const syncToJson = require('../scripts/syncToJson');

/**
 * 格式化 Club 对象为统一的输出格式
 * 不包含 id 字段，使用 name+school 作为标识
 */
function formatClub(club) {
  // 处理外部链接，移除 MongoDB 的 _id 字段
  let externalLinks = [];
  if (club.externalLinks && Array.isArray(club.externalLinks)) {
    externalLinks = club.externalLinks.map(link => ({
      type: link.type,
      url: link.url
    }));
  }

  return {
    name: club.name,
    school: club.school,
    city: club.city || '',
    province: club.province,
    coordinates: club.coordinates || [0, 0],
    logo: club.logo || club.logo || '',
    shortDescription: club.shortDescription || '',
    description: club.description || '',
    tags: club.tags || [],
    externalLinks: externalLinks
  };
}

/**
 * POST /api/sync/migrate-json-to-db
 * 将 JSON 文件数据迁移到数据库（清空数据库后导入）
 * 类似于 migrateClubs.js 脚本的功能
 */
router.post('/migrate-json-to-db', authenticate, async (req, res) => {
  try {
    // 读取 clubs.json
    const jsonPath = path.resolve(__dirname, '../../public/data/clubs.json');
    let clubs = [];
    try {
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      clubs = JSON.parse(jsonData);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'JSON_NOT_FOUND',
        message: 'clubs.json 文件不存在'
      });
    }

    console.log(`📄 Found ${clubs.length} clubs in clubs.json`);

    // 第一步：完全删除数据库中的所有 Club 记录
    console.log('\n🗑️  Clearing database...');
    const deleteResult = await Club.deleteMany({});
    console.log(`  Deleted ${deleteResult.deletedCount} existing clubs`);

    let imported = 0;
    let skipped = 0;

    // 第二步：从 clubs.json 中导入所有数据
    console.log('\n📥 Importing from clubs.json...');
    for (const club of clubs) {
      try {
        // 支持两种坐标格式
        let coordinates;
        if (club.coordinates && Array.isArray(club.coordinates) && club.coordinates.length === 2) {
          // 使用 coordinates 数组 [lng, lat]
          coordinates = club.coordinates;
        } else if (club.longitude !== undefined && club.latitude !== undefined) {
          // 使用 longitude/latitude 字段 [lng, lat]
          coordinates = [club.longitude, club.latitude];
        } else {
          throw new Error('Missing coordinates data');
        }

        const clubData = {
          name: club.name,
          school: club.school,
          province: club.province,
          city: club.city || '',
          coordinates: coordinates, // [lng, lat]
          description: club.description || club.shortDescription || '',
          shortDescription: club.shortDescription || '',
          tags: club.tags || [],
          logo: club.logo || '',
          externalLinks: club.externalLinks || [],
          verifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // 创建新记录
        const newClub = new Club(clubData);
        await newClub.save();
        imported++;
        const linkInfo = clubData.externalLinks?.length > 0 ? ` (${clubData.externalLinks.length} links)` : '';
        console.log(`  ✓ Imported: ${club.name} (${club.school})${linkInfo}`);
      } catch (error) {
        console.error(`  ✗ Failed to import ${club.name}:`, error.message);
        skipped++;
      }
    }

    // 获取最终数据库统计
    const finalCount = await Club.countDocuments();

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log(`  ✓ Imported: ${imported}`);
    console.log(`  ✗ Skipped: ${skipped}`);
    console.log(`  📄 Total in JSON: ${clubs.length}`);
    console.log(`  💾 Total in DB: ${finalCount} (after migration)`);
    console.log('='.repeat(60));

    return res.json({
      success: true,
      message: 'JSON → Database 迁移完成',
      data: {
        imported,
        skipped,
        totalInJson: clubs.length,
        totalInDb: finalCount
      }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return res.status(500).json({
      success: false,
      error: 'MIGRATION_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/sync/compare
 * 对比数据库和JSON文件中的数据
 */
router.get('/compare', authenticate, async (req, res) => {
  try {
    // 读取 MongoDB 数据
    const dbClubs = await Club.find({}).lean();
    
    // 读取 JSON 文件数据
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

    // 创建映射表（使用 name+school 作为标识）
    const dbMap = new Map();
    const jsonMap = new Map();
    const nameSchoolMap = new Map(); // 用于按 name+school 匹配

    dbClubs.forEach(club => {
      const formatted = formatClub(club);
      const key = `${formatted.name.toLowerCase()}-${formatted.school.toLowerCase()}`;
      dbMap.set(key, { db: formatted, mongoId: club._id });
    });

    jsonClubs.forEach(club => {
      const key = `${club.name.toLowerCase()}-${club.school.toLowerCase()}`;
      jsonMap.set(key, club);
      if (dbMap.has(key)) {
        dbMap.get(key).json = club;
      }
    });

    // 分类结果
    const result = {
      identical: [],      // 完全相同
      different: [],      // 存在差异
      dbOnly: [],        // 仅在数据库中
      jsonOnly: [],      // 仅在JSON中
      duplicates: []     // 重复记录
    };

    // 检测重复记录
    const duplicateGroups = detectDuplicates(dbClubs, jsonClubs);
    result.duplicates = duplicateGroups;

    // 按 name+school 比对
    for (const [key, data] of dbMap) {
      if (data.db && data.json) {
        // name+school 相同
        const differences = findDifferences(data.db, data.json);
        
        if (differences.length === 0) {
          result.identical.push({
            club: data.db,
            source: 'both'
          });
        } else {
          result.different.push({
            db: data.db,
            json: data.json,
            differences: differences
          });
        }
      } else if (data.db && !data.json) {
        result.dbOnly.push(data.db);
      } else if (!data.db && data.json) {
        result.jsonOnly.push(data.json);
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
        duplicates: result.duplicates.length
      }
    };

    return res.json({
      success: true,
      data: {
        stats,
        details: result
      }
    });

  } catch (error) {
    console.error('❌ Compare failed:', error);
    return res.status(500).json({
      success: false,
      error: 'COMPARE_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/sync/merge
 * 执行智能合并：MongoDB <-> JSON 双向同步
 * 
 * 关键设计：
 * - JSON 中的 ID 永远被保留和优先使用
 * - 通过名称+学校字段进行智能匹配
 * - 避免 ID 格式变更导致的数据混乱
 * 
 * 处理流程：
 * 1. JSON -> MongoDB: 将 JSON 中的新数据添加或更新到数据库
 * 2. MongoDB -> JSON: 更新 JSON 中的字段内容，但保留原始 ID
 * 3. 保留两方独有的记录（未被对方匹配的记录）
 */
router.post('/merge', authenticate, async (req, res) => {
  try {
    // 读取 MongoDB 数据
    const dbClubs = await Club.find({}).lean();
    
    // 读取 JSON 文件数据
    const jsonPath = path.resolve(__dirname, '../../public/data/clubs.json');
    let jsonClubs = [];
    try {
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      jsonClubs = JSON.parse(jsonData);
    } catch (error) {
      jsonClubs = [];
    }

    // 创建映射表（基于 name+school）
    const dbClubsAfterFirstStep = await Club.find({}).lean();
    const dbNameSchoolMap = new Map(); // name+school -> club
    
    dbClubsAfterFirstStep.forEach(club => {
      const key = `${club.name}|${club.school}`;
      dbNameSchoolMap.set(key, club);
    });
    
    const jsonNameSchoolMap = new Map(); // name+school -> club
    
    jsonClubs.forEach(club => {
      const key = `${club.name}|${club.school}`;
      jsonNameSchoolMap.set(key, club);
    });

    let dbAdded = 0;
    let dbUpdated = 0;
    let jsonAdded = 0;
    let jsonUpdated = 0;
    let unchanged = 0;

    // ========== 第一步：处理 JSON -> MongoDB ==========
    // 将 JSON 中的数据合并到 MongoDB（仅合并新增）
    for (const jsonClub of jsonClubs) {
      try {
        const nameSchoolKey = `${jsonClub.name}|${jsonClub.school}`;
        const existingClub = await Club.findOne({
          name: jsonClub.name,
          school: jsonClub.school
        });

        if (existingClub) {
          // 检查是否需要更新
          const dbStr = JSON.stringify({
            name: existingClub.name,
            school: existingClub.school,
            city: existingClub.city,
            province: existingClub.province,
            coordinates: existingClub.coordinates,
            description: existingClub.description,
            shortDescription: existingClub.shortDescription,
            tags: existingClub.tags || [],
            externalLinks: existingClub.externalLinks || []
          });
          
          const jsonStr = JSON.stringify({
            name: jsonClub.name,
            school: jsonClub.school,
            city: jsonClub.city,
            province: jsonClub.province,
            coordinates: [jsonClub.longitude, jsonClub.latitude],
            description: jsonClub.description,
            shortDescription: jsonClub.shortDescription,
            tags: jsonClub.tags || [],
            externalLinks: jsonClub.externalLinks || []
          });

          if (dbStr !== jsonStr) {
            // 更新数据库中的记录（使用 JSON 中的值）
            await Club.findByIdAndUpdate(
              existingClub._id,
              {
                name: jsonClub.name,
                school: jsonClub.school,
                city: jsonClub.city,
                province: jsonClub.province,
                coordinates: [jsonClub.longitude, jsonClub.latitude],
                description: jsonClub.description,
                shortDescription: jsonClub.shortDescription,
                tags: jsonClub.tags || [],
                externalLinks: jsonClub.externalLinks || [],
                logo: jsonClub.logo || ''
              },
              { new: true }
            );
            dbUpdated++;
            console.log(`✏️  Updated in DB: ${jsonClub.name} (${jsonClub.school})`);
          } else {
            unchanged++;
          }
        } else {
          // JSON 中的记录在数据库中完全不存在，添加到数据库
          // 注意：使用 MongoDB 自动生成的 ObjectId，而不是 JSON 中的 ID
          // 这样可以避免 ID 格式不兼容的问题
          await Club.create({
            name: jsonClub.name,
            school: jsonClub.school,
            city: jsonClub.city,
            province: jsonClub.province,
            coordinates: [jsonClub.longitude, jsonClub.latitude],
            description: jsonClub.description,
            shortDescription: jsonClub.shortDescription,
            tags: jsonClub.tags || [],
            externalLinks: jsonClub.externalLinks || [],
            logo: jsonClub.logo || ''
          });
          dbAdded++;
          console.log(`✅ Added to DB: ${jsonClub.name} (${jsonClub.school})`);
        }
      } catch (error) {
        console.error(`❌ Error processing JSON club ${jsonClub.name}:`, error.message);
      }
    }

    // ========== 第二步：处理 MongoDB -> JSON ==========
    // 更新 JSON 中已存在的记录，添加 DB 中独有的记录
    const updatedJsonClubs = [];
    const processedNameSchools = new Set(); // name+school -> 已处理过的组合
    
    // 先添加所有在 DB 中有对应的 JSON 记录（已更新的）
    for (const jsonClub of jsonClubs) {
      const nameSchoolKey = `${jsonClub.name}|${jsonClub.school}`;
      const dbClub = dbNameSchoolMap.get(nameSchoolKey);
      
      if (dbClub) {
        // 找到匹配的 DB 记录，使用 DB 数据更新 JSON
        const updated = formatClub(dbClub);
        updatedJsonClubs.push(updated);
        processedNameSchools.add(nameSchoolKey);
        jsonUpdated++;
        console.log(`🔄 Updated in JSON: ${jsonClub.name} (${jsonClub.school})`);
      } else {
        // JSON 中有，但 DB 中没有 - 保留这条 JSON 记录（JSON 独有）
        updatedJsonClubs.push(jsonClub);
        processedNameSchools.add(nameSchoolKey);
        console.log(`📝 Preserved JSON-only: ${jsonClub.name} (${jsonClub.school})`);
      }
    }

    // 添加 DB 中独有的记录（在 JSON 中不存在）
    for (const [nameSchoolKey, dbClub] of dbNameSchoolMap.entries()) {
      if (!processedNameSchools.has(nameSchoolKey)) {
        const formatted = formatClub(dbClub);
        updatedJsonClubs.push(formatted);
        jsonAdded++;
        console.log(`✨ Added from DB to JSON: ${dbClub.name} (${dbClub.school})`);
      }
    }

    // 按 index 排序，然后按 name 排序
    updatedJsonClubs.sort((a, b) => {
      if ((a.index || 0) !== (b.index || 0)) {
        return (a.index || 0) - (b.index || 0);
      }
      return a.name.localeCompare(b.name);
    });

    // 保存更新后的 JSON 文件
    fs.writeFileSync(
      jsonFilePath,
      JSON.stringify(updatedJsonClubs, null, 2),
      'utf-8'
    );

    return res.json({
      success: true,
      message: '双向智能合并完成',
      data: {
        database: {
          added: dbAdded,
          updated: dbUpdated
        },
        json: {
          added: jsonAdded,
          updated: jsonUpdated,
          unchanged: unchanged
        },
        total: {
          added: dbAdded + jsonAdded,
          updated: dbUpdated + jsonUpdated,
          unchanged: unchanged
        }
      }
    });

  } catch (error) {
    console.error('❌ Merge failed:', error);
    return res.status(500).json({
      success: false,
      error: 'MERGE_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/sync/replace
 * 执行完全替换：MongoDB -> JSON（单向覆盖）
 * - 用 MongoDB 中的所有数据完全覆盖 JSON 文件
 * - JSON 中独有的记录将被删除
 */
router.post('/replace', authenticate, async (req, res) => {
  try {
    const result = await syncToJson('replace');
    
    return res.json({
      success: true,
      message: '完全替换完成（MongoDB -> JSON）',
      data: result
    });

  } catch (error) {
    console.error('❌ Replace failed:', error);
    return res.status(500).json({
      success: false,
      error: 'REPLACE_FAILED',
      message: error.message
    });
  }
});

/**
 * 查找两个对象之间的差异
 */
function findDifferences(obj1, obj2) {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
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

/**
 * 检测重复记录
 * 根据不同的判断依据检测数据库和 JSON 中的重复记录
 */
function detectDuplicates(dbClubs, jsonClubs) {
  const duplicateGroups = [];
  
  // 1. 按名称+学校检测重复（最严格）
  const nameSchoolMap = new Map();
  
  // 收集数据库中的记录
  dbClubs.forEach(club => {
    const key = `${club.name.toLowerCase().trim()}-${club.school.toLowerCase().trim()}`;
    if (!nameSchoolMap.has(key)) {
      nameSchoolMap.set(key, []);
    }
    nameSchoolMap.get(key).push({
      identifier: `${club.name}|${club.school}`,
      name: club.name,
      school: club.school,
      source: 'database'
    });
  });
  
  // 收集 JSON 中的记录
  jsonClubs.forEach(club => {
    const key = `${club.name.toLowerCase().trim()}-${club.school.toLowerCase().trim()}`;
    if (!nameSchoolMap.has(key)) {
      nameSchoolMap.set(key, []);
    }
    nameSchoolMap.get(key).push({
      identifier: `${club.name}|${club.school}`,
      name: club.name,
      school: club.school,
      source: 'json'
    });
  });
  
  // 找出有重复的组
  for (const [key, records] of nameSchoolMap) {
    if (records.length > 1) {
      // 不同来源的记录不算重复
      const sourceSet = new Set(records.map(r => r.source));
      
      if (sourceSet.size === 1 && records.length > 1) {
        duplicateGroups.push({
          criteria: '名称 + 学校',
          key: key,
          records: records
        });
      }
    }
  }
  
  // 2. 按名称检测重复（可能是同一社团在不同学校）
  const nameMap = new Map();
  
  dbClubs.forEach(club => {
    const key = club.name.toLowerCase().trim();
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key).push({
      identifier: `${club.name}|${club.school}`,
      name: club.name,
      school: club.school,
      source: 'database'
    });
  });
  
  jsonClubs.forEach(club => {
    const key = club.name.toLowerCase().trim();
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key).push({
      identifier: `${club.name}|${club.school}`,
      name: club.name,
      school: club.school,
      source: 'json'
    });
  });
  
  for (const [key, records] of nameMap) {
    // 只有当有多个不同学校时才算
    const schools = new Set(records.map(r => r.school.toLowerCase().trim()));
    if (schools.size > 1 && records.length >= 2) {
      // 检查是否已经在名称+学校组中
      const alreadyReported = duplicateGroups.some(group => 
        group.criteria === '名称 + 学校' && 
        records.every(r => group.records.some(gr => gr.identifier === r.identifier))
      );
      
      if (!alreadyReported) {
        duplicateGroups.push({
          criteria: '名称相同（不同学校）',
          key: key,
          records: records
        });
      }
    }
  }
  
  // 3. 按坐标检测重复（位置相同）
  const coordMap = new Map();
  
  dbClubs.forEach(club => {
    if (club.coordinates && club.coordinates.length === 2) {
      const key = `${club.coordinates[0].toFixed(6)},${club.coordinates[1].toFixed(6)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
      }
      coordMap.get(key).push({
        identifier: `${club.name}|${club.school}`,
        name: club.name,
        school: club.school,
        source: 'database'
      });
    }
  });
  
  jsonClubs.forEach(club => {
    let coords;
    if (club.coordinates && club.coordinates.length === 2) {
      coords = club.coordinates;
    } else if (club.longitude !== undefined && club.latitude !== undefined) {
      coords = [club.longitude, club.latitude];
    }
    
    if (coords) {
      const key = `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
      }
      coordMap.get(key).push({
        identifier: `${club.name}|${club.school}`,
        name: club.name,
        school: club.school,
        source: 'json'
      });
    }
  });
  
  for (const [key, records] of coordMap) {
    if (records.length > 1) {
      // 检查是否是不同的社团
      const uniqueNames = new Set(records.map(r => `${r.name}-${r.school}`));
      if (uniqueNames.size > 1) {
        duplicateGroups.push({
          criteria: '坐标相同',
          key: `坐标: ${key}`,
          records: records
        });
      }
    }
  }
  
  return duplicateGroups;
}

/**
 * POST /api/sync/atomic-merge-json-to-db
 * 原子化合并：将单条 JSON 记录覆盖或添加到 Database
 * 请求体：{ identifier: "name|school" }
 */
router.post('/atomic-merge-json-to-db', authenticate, async (req, res) => {
  try {
    const { identifier } = req.body;
    
    if (!identifier || !identifier.includes('|')) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IDENTIFIER',
        message: '无效的标识符格式，应为 name|school'
      });
    }

    const [name, school] = identifier.split('|').map(s => s.trim());

    if (!name || !school) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IDENTIFIER',
        message: '无效的标识符，name 或 school 为空'
      });
    }

    // 读取 JSON 文件
    const jsonPath = path.resolve(__dirname, '../../public/data/clubs.json');
    const jsonData = await fs.readFile(jsonPath, 'utf8');
    const clubs = JSON.parse(jsonData);

    // 查找 JSON 中的对应记录
    const jsonClub = clubs.find(c => c.name === name && c.school === school);

    if (!jsonClub) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `在 JSON 中找不到社团: ${identifier}`
      });
    }

    // 查找或创建 Database 中的记录
    let dbClub = await Club.findOne({ name, school });

    if (dbClub) {
      // 更新现有记录
      dbClub.city = jsonClub.city || dbClub.city;
      dbClub.province = jsonClub.province || dbClub.province;
      dbClub.coordinates = jsonClub.coordinates || dbClub.coordinates;
      dbClub.logo = jsonClub.logo || dbClub.logo;
      dbClub.shortDescription = jsonClub.shortDescription || dbClub.shortDescription;
      dbClub.description = jsonClub.description || dbClub.description;
      dbClub.tags = jsonClub.tags || dbClub.tags;
      dbClub.externalLinks = jsonClub.externalLinks || dbClub.externalLinks;
      await dbClub.save();
      console.log(`✏️  更新 Database 记录: ${name} (${school})`);
    } else {
      // 创建新记录
      dbClub = await Club.create({
        name,
        school,
        city: jsonClub.city || '',
        province: jsonClub.province || '',
        coordinates: jsonClub.coordinates || [0, 0],
        logo: jsonClub.logo || '',
        shortDescription: jsonClub.shortDescription || '',
        description: jsonClub.description || '',
        tags: jsonClub.tags || [],
        externalLinks: jsonClub.externalLinks || [],
        index: await Club.countDocuments() // 分配新的 index
      });
      console.log(`✅ 创建新 Database 记录: ${name} (${school})`);
    }

    return res.json({
      success: true,
      message: `原子化合并成功: ${identifier}`,
      data: {
        action: dbClub ? '更新' : '创建',
        club: {
          name: dbClub.name,
          school: dbClub.school
        }
      }
    });

  } catch (error) {
    console.error('❌ Atomic merge JSON→DB error:', error);
    return res.status(500).json({
      success: false,
      error: 'MERGE_FAILED',
      message: error.message || '原子化合并失败'
    });
  }
});

/**
 * POST /api/sync/atomic-merge-db-to-json
 * 原子化合并：将单条 Database 记录覆盖或添加到 JSON 文件
 * 请求体：{ identifier: "name|school" }
 */
router.post('/atomic-merge-db-to-json', authenticate, async (req, res) => {
  try {
    const { identifier } = req.body;
    
    if (!identifier || !identifier.includes('|')) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IDENTIFIER',
        message: '无效的标识符格式，应为 name|school'
      });
    }

    const [name, school] = identifier.split('|').map(s => s.trim());

    if (!name || !school) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IDENTIFIER',
        message: '无效的标识符，name 或 school 为空'
      });
    }

    // 查找 Database 中的记录
    const dbClub = await Club.findOne({ name, school });

    if (!dbClub) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `在 Database 中找不到社团: ${identifier}`
      });
    }

    // 读取 JSON 文件
    const jsonPath = path.resolve(__dirname, '../../public/data/clubs.json');
    const jsonData = await fs.readFile(jsonPath, 'utf8');
    let clubs = JSON.parse(jsonData);

    // 查找 JSON 中的对应记录
    const existingIndex = clubs.findIndex(c => c.name === name && c.school === school);
    const formattedClub = formatClub(dbClub);

    if (existingIndex >= 0) {
      // 更新现有记录
      clubs[existingIndex] = formattedClub;
      console.log(`✏️  更新 JSON 记录: ${name} (${school})`);
    } else {
      // 添加新记录
      clubs.push(formattedClub);
      console.log(`✅ 添加新 JSON 记录: ${name} (${school})`);
    }

    // 按 index 排序后写回
    const dbClubsForSort = await Club.find({}).lean().sort({ index: 1 });
    const indexMap = new Map();
    dbClubsForSort.forEach((club, idx) => {
      indexMap.set(`${club.name}|${club.school}`, idx);
    });

    clubs.sort((a, b) => {
      const aIdx = indexMap.get(`${a.name}|${a.school}`) || 0;
      const bIdx = indexMap.get(`${b.name}|${b.school}`) || 0;
      return aIdx - bIdx;
    });

    await fs.writeFile(jsonPath, JSON.stringify(clubs, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: `原子化合并成功: ${identifier}`,
      data: {
        action: existingIndex >= 0 ? '更新' : '创建',
        club: {
          name: dbClub.name,
          school: dbClub.school
        }
      }
    });

  } catch (error) {
    console.error('❌ Atomic merge DB→JSON error:', error);
    return res.status(500).json({
      success: false,
      error: 'MERGE_FAILED',
      message: error.message || '原子化合并失败'
    });
  }
});

/**
 * POST /api/sync/overwrite-json
 * 用 Database 中的所有数据覆盖 JSON 文件
 * 这是 replace 端点的反向操作（DB → JSON）
 */
router.post('/overwrite-json', authenticate, async (req, res) => {
  try {
    const dbClubs = await Club.find({}).lean().sort({ index: 1, name: 1 });

    if (!dbClubs || dbClubs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_DATA',
        message: '数据库中没有任何社团'
      });
    }

    // 格式化所有 Database 记录为 JSON 格式
    const formattedClubs = dbClubs.map(club => formatClub(club));

    // 写入 JSON 文件
    const jsonPath = path.resolve(__dirname, '../../public/data/clubs.json');
    await fs.writeFile(jsonPath, JSON.stringify(formattedClubs, null, 2), 'utf-8');

    console.log(`✅ 成功用 Database 覆盖 JSON 文件，共 ${formattedClubs.length} 个社团`);

    return res.json({
      success: true,
      message: '成功用 Database 数据覆盖 JSON 文件',
      data: {
        total: formattedClubs.length,
        action: 'Database → JSON'
      }
    });

  } catch (error) {
    console.error('❌ Overwrite JSON error:', error);
    return res.status(500).json({
      success: false,
      error: 'OVERWRITE_FAILED',
      message: error.message || '覆盖失败'
    });
  }
});

/**
 * POST /api/sync/git-pull
 * 执行 git pull 操作
 * 需要管理员权限和启用的 Git 操作
 */
router.post('/git-pull', authenticateGitOperations, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const projectRoot = path.resolve(__dirname, '../../');

    console.log(`📥 [Git Pull] 用户 ${req.user.username} 执行 Git Pull`);
    const { stdout, stderr } = await execAsync('git pull', { cwd: projectRoot });

    // 检查是否有冲突
    if (stderr && stderr.includes('conflict')) {
      console.warn(`⚠️ [Git Pull] 冲突: ${stderr}`);
      return res.status(409).json({
        success: false,
        error: 'GIT_CONFLICT',
        message: `Git Pull 遭遇冲突：${stderr}`
      });
    }

    console.log(`✅ [Git Pull] 成功: ${stdout.trim()}`);
    return res.status(200).json({
      success: true,
      message: 'Git Pull 完成',
      data: {
        message: stdout.trim() || 'Already up to date'
      }
    });

  } catch (error) {
    console.error(`❌ [Git Pull] 错误: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'GIT_PULL_FAILED',
      message: error.message || 'Git Pull 失败'
    });
  }
});

/**
 * POST /api/sync/git-push
 * 执行 git add -> commit -> push 操作
 * 需要管理员权限和启用的 Git 操作
 */
router.post('/git-push', authenticateGitOperations, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const projectRoot = path.resolve(__dirname, '../../');

    console.log(`📥 [Git Push] 用户 ${req.user.username} 执行 Git Add`);
    await execAsync('git add .', { cwd: projectRoot });

    // 检查是否有更改
    const { stdout: statusStdout } = await execAsync('git status --porcelain', { cwd: projectRoot });
    
    if (!statusStdout.trim()) {
      console.log('ℹ️  [Git Push] 没有更改可提交');
      return res.status(200).json({
        success: true,
        message: '没有更改可提交',
        data: {
          message: 'Working directory is clean'
        }
      });
    }

    console.log(`💾 [Git Push] 执行 Commit`);
    const commitDate = new Date().toISOString();
    const { stdout: commitStdout } = await execAsync(
      `git commit -m "Auto commit: ${commitDate}"`,
      { cwd: projectRoot }
    );

    console.log(`🚀 [Git Push] 执行 Push`);
    const { stdout: pushStdout, stderr: pushStderr } = await execAsync('git push', { cwd: projectRoot });

    // 检查是否有冲突
    if (pushStderr && (pushStderr.includes('conflict') || pushStderr.includes('rejected'))) {
      console.warn(`⚠️ [Git Push] 被拒绝: ${pushStderr}`);
      return res.status(409).json({
        success: false,
        error: 'GIT_CONFLICT',
        message: `Git Push 失败，请先拉取最新代码：${pushStderr}`
      });
    }

    console.log(`✅ [Git Push] 成功: ${pushStdout.trim()}`);
    return res.status(200).json({
      success: true,
      message: 'Git 提交成功',
      data: {
        message: pushStdout.trim() || 'Pushed successfully'
      }
    });

  } catch (error) {
    console.error(`❌ [Git Push] 错误: ${error.message}`);
    
    // 检查是否是冲突错误
    if (error.message && (error.message.includes('conflict') || error.message.includes('rejected'))) {
      return res.status(409).json({
        success: false,
        error: 'GIT_CONFLICT',
        message: `遭遇 Git 冲突，请手动解决：${error.message}`
      });
    }

    return res.status(500).json({
      success: false,
      error: 'GIT_PUSH_FAILED',
      message: error.message || 'Git 提交失败'
    });
  }
});

module.exports = router;
