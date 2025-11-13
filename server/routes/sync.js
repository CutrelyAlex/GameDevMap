const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Club = require('../models/Club');
const { authenticate } = require('../middleware/auth');
const syncToJson = require('../scripts/syncToJson');

/**
 * 格式化 Club 对象为统一的 MongoDB 格式
 * 
 * 统一后的格式（驼峰命名）：
 * - id, name, school, city, province
 * - coordinates: [lng, lat]
 * - logo, shortDescription, description
 * - tags, externalLinks (无 _id)
 */
function formatClub(club) {
  // 处理外部链接，移除 MongoDB 的 _id 字段
  let externalLinks = [];
  if (club.externalLinks && Array.isArray(club.externalLinks)) {
    externalLinks = club.externalLinks.map(link => ({
      type: link.type,
      url: link.url
    }));
  } else if (club.externalLinks && Array.isArray(club.externalLinks)) {
    // 兼容旧字段名
    externalLinks = club.externalLinks.map(link => ({
      type: link.type,
      url: link.url
    }));
  }

  return {
    id: club._id ? club._id.toString() : club.id,
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

    // 创建映射表
    const dbMap = new Map();
    const jsonMap = new Map();
    const nameMap = new Map(); // 用于按名称匹配

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
      identical: [],      // 完全相同
      different: [],      // 存在差异
      dbOnly: [],        // 仅在数据库中
      jsonOnly: [],      // 仅在JSON中
      conflicts: [],      // 名称相同但ID不同（可能的冲突）
      duplicates: []     // 重复记录
    };

    // 检测重复记录
    const duplicateGroups = detectDuplicates(dbClubs, jsonClubs);
    result.duplicates = duplicateGroups;

    // 按名称比对
    for (const [key, data] of nameMap) {
      if (data.db && data.json) {
        if (data.db.id === data.json.id) {
          // ID相同，检查内容是否相同
          // 先将数据库对象转换为JSON格式，然后进行比较
          const dbFormatted = formatClub(data.db);
          const differences = findDifferences(dbFormatted, data.json);
          
          if (differences.length === 0) {
            result.identical.push({
              club: dbFormatted,
              source: 'both'
            });
          } else {
            result.different.push({
              db: dbFormatted,
              json: data.json,
              differences: differences
            });
          }
        } else {
          // 名称相同但ID不同，可能是冲突
          result.conflicts.push({
            db: data.db,
            json: data.json,
            reason: 'Same name but different ID'
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
        conflicts: result.conflicts.length,
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

    // 创建映射表（注意：merge 后需要重新查询 MongoDB，因为第一步可能已修改数据）
    const dbClubsAfterFirstStep = await Club.find({}).lean();
    const dbMap = new Map();
    const nameMap = new Map(); // 用于名称+学校匹配
    
    dbClubsAfterFirstStep.forEach(club => {
      dbMap.set(club._id.toString(), club);
      const key = `${club.name}-${club.school}`;
      nameMap.set(key, club);
    });
    
    const jsonMap = new Map();
    const jsonNameMap = new Map();
    
    jsonClubs.forEach(club => {
      jsonMap.set(club.id, club);
      const key = `${club.name}-${club.school}`;
      jsonNameMap.set(key, club);
    });

    let dbAdded = 0;
    let dbUpdated = 0;
    let jsonAdded = 0;
    let jsonUpdated = 0;
    let unchanged = 0;

    // ========== 第一步：处理 JSON -> MongoDB ==========
    // 将 JSON 中的数据合并到 MongoDB
    for (const jsonClub of jsonClubs) {
      try {
        // 首先尝试通过 ID 精确匹配
        let existingClub = null;
        try {
          existingClub = await Club.findById(jsonClub.id);
        } catch (e) {
          // ID 格式不是有效的 ObjectId，尝试通过名称+学校匹配
          existingClub = null;
        }

        // 如果 ID 匹配失败，尝试通过名称+学校匹配
        if (!existingClub) {
          existingClub = await Club.findOne({
            name: jsonClub.name,
            school: jsonClub.school
          });
        }

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
    // 将 MongoDB 中的新数据添加到 JSON，并更新现有记录
    const updatedJsonClubs = [];
    const processedJsonIds = new Set(); // 跟踪已处理的 JSON ID，防止重复
    
    for (const dbClub of dbClubsAfterFirstStep) {
      const id = dbClub._id.toString();
      const formattedClub = formatClub(dbClub);
      const nameKey = `${dbClub.name}-${dbClub.school}`;
      
      // 1. 先检查是否存在于 JSON 中（通过原始 JSON ID）
      let matchedJsonClub = null;
      for (const jsonClub of jsonClubs) {
        if (jsonClub.id === id) {
          matchedJsonClub = jsonClub;
          break;
        }
      }
      
      // 2. 如果原始 ID 不匹配，尝试通过名称+学校匹配
      if (!matchedJsonClub) {
        matchedJsonClub = jsonClubs.find(j => j.name === dbClub.name && j.school === dbClub.school);
      }
      
      if (matchedJsonClub) {
        // 记录已处理，避免后面重复添加
        processedJsonIds.add(matchedJsonClub.id);
        
        // 找到匹配的 JSON 记录，更新内容但保留 ID
        const merged = {
          ...formattedClub,
          id: matchedJsonClub.id,  // 使用 JSON 原始 ID
          ...matchedJsonClub        // JSON 中的其他信息作为备选
        };
        updatedJsonClubs.push(merged);
      } else {
        // MongoDB 中的这个记录在 JSON 中完全没有对应
        // 只有当 JSON 中确实没有这个名称的记录时，才添加
        if (!jsonNameMap.has(nameKey)) {
          updatedJsonClubs.push(formattedClub);
          jsonAdded++;
        }
        // 否则说明在名称+学校上已被处理过（可能是旧版本），不重复添加
      }
    }

    // 3. 添加 JSON 中独有的记录（在 MongoDB 中不存在且未被处理过）
    for (const jsonClub of jsonClubs) {
      if (!processedJsonIds.has(jsonClub.id) && !nameMap.has(`${jsonClub.name}-${jsonClub.school}`)) {
        updatedJsonClubs.push(jsonClub);
      }
    }

    // 写入更新后的 JSON 文件
    await fs.writeFile(
      jsonPath,
      JSON.stringify(updatedJsonClubs, null, 2),
      'utf8'
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
      id: club._id.toString(),
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
      id: club.id,
      name: club.name,
      school: club.school,
      source: 'json'
    });
  });
  
  // 找出有重复的组
  for (const [key, records] of nameSchoolMap) {
    if (records.length > 1) {
      // 检查是否真的是重复（可能同一个记录在两个地方都有）
      const uniqueIds = new Set(records.map(r => r.id));
      
      // 如果有多个不同的 ID，或者同一个 ID 在不同来源出现多次
      if (uniqueIds.size > 1 || records.length > uniqueIds.size) {
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
      id: club._id.toString(),
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
      id: club.id,
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
        records.every(r => group.records.some(gr => gr.id === r.id))
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
        id: club._id.toString(),
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
        id: club.id,
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

module.exports = router;
