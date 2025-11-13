const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Club = require('../models/Club');
const { authenticate } = require('../middleware/auth');
const syncToJson = require('../scripts/syncToJson');

/**
 * 格式化 Club 对象为标准格式
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
    website: club.website || '',
    contact: club.contact || {}
  };
}

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
      conflicts: []      // 名称相同但ID不同（可能的冲突）
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
              db: data.db,
              json: data.json,
              differences: findDifferences(data.db, data.json)
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
        conflicts: result.conflicts.length
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
 * - 更新 MongoDB 中已存在的 JSON 记录
 * - 添加 JSON 中不存在的新 MongoDB 记录到 JSON
 * - 更新 JSON 中不存在的新记录到 MongoDB
 * - 保留两方独有的记录
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

    // 创建映射表
    const dbMap = new Map();
    const jsonMap = new Map();
    
    dbClubs.forEach(club => {
      dbMap.set(club._id.toString(), club);
    });
    
    jsonClubs.forEach(club => {
      jsonMap.set(club.id, club);
    });

    let dbAdded = 0;
    let dbUpdated = 0;
    let jsonAdded = 0;
    let jsonUpdated = 0;
    let unchanged = 0;

    // ========== 第一步：处理 JSON -> MongoDB ==========
    // 将 JSON 中的数据合并到 MongoDB
    for (const jsonClub of jsonClubs) {
      if (dbMap.has(jsonClub.id)) {
        // JSON 中的记录在数据库中存在，检查是否需要更新
        const dbClub = dbMap.get(jsonClub.id);
        const dbStr = JSON.stringify({
          name: dbClub.name,
          school: dbClub.school,
          city: dbClub.city,
          province: dbClub.province,
          coordinates: dbClub.coordinates,
          description: dbClub.description,
          shortDescription: dbClub.shortDescription,
          tags: dbClub.tags || [],
          website: dbClub.website,
          contact: dbClub.contact || {}
        });
        
        const jsonStr = JSON.stringify({
          name: jsonClub.name,
          school: jsonClub.school,
          city: jsonClub.city,
          province: jsonClub.province,
          coordinates: [jsonClub.longitude, jsonClub.latitude],
          description: jsonClub.long_description,
          shortDescription: jsonClub.short_description,
          tags: jsonClub.tags || [],
          website: jsonClub.website,
          contact: jsonClub.contact || {}
        });

        if (dbStr !== jsonStr) {
          // 更新数据库中的记录（使用 JSON 中的值）
          await Club.findByIdAndUpdate(
            jsonClub.id,
            {
              name: jsonClub.name,
              school: jsonClub.school,
              city: jsonClub.city,
              province: jsonClub.province,
              coordinates: [jsonClub.longitude, jsonClub.latitude],
              description: jsonClub.long_description,
              shortDescription: jsonClub.short_description,
              tags: jsonClub.tags || [],
              website: jsonClub.website,
              contact: jsonClub.contact || {}
            },
            { new: true }
          );
          dbUpdated++;
        } else {
          unchanged++;
        }
      } else {
        // JSON 中的记录在数据库中不存在，添加到数据库
        await Club.create({
          _id: jsonClub.id,
          name: jsonClub.name,
          school: jsonClub.school,
          city: jsonClub.city,
          province: jsonClub.province,
          coordinates: [jsonClub.longitude, jsonClub.latitude],
          description: jsonClub.long_description,
          shortDescription: jsonClub.short_description,
          tags: jsonClub.tags || [],
          website: jsonClub.website,
          contact: jsonClub.contact || {},
          logo: jsonClub.img_name || ''
        });
        dbAdded++;
      }
    }

    // ========== 第二步：处理 MongoDB -> JSON ==========
    // 将 MongoDB 中的新数据添加到 JSON，并更新现有记录
    const updatedJsonClubs = [];
    
    for (const dbClub of dbClubs) {
      const id = dbClub._id.toString();
      const formattedClub = formatClub(dbClub);
      
      if (jsonMap.has(id)) {
        const existing = jsonMap.get(id);
        // 合并：优先使用 JSON 中的修改，但使用 MongoDB 中的新字段
        const merged = {
          ...formattedClub,  // MongoDB 数据作为基础
          ...existing        // JSON 数据会覆盖重复的字段
        };
        updatedJsonClubs.push(merged);
      } else {
        // 数据库中存在但 JSON 中不存在的记录，添加到 JSON
        updatedJsonClubs.push(formattedClub);
        jsonAdded++;
      }
    }

    // 添加 JSON 中独有的记录（在数据库中不存在）
    for (const jsonClub of jsonClubs) {
      if (!dbMap.has(jsonClub.id)) {
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

module.exports = router;
