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
 * POST /api/sync/jsonToDB
 * 执行 JSON -> DB 替换：用 JSON 文件完全覆盖 MongoDB 数据库
 * - 用 JSON 文件中的所有数据完全覆盖 MongoDB
 * - MongoDB 中独有的记录将被删除
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

    // 清空数据库
    await Club.deleteMany({});

    // 插入 JSON 数据到数据库
    let insertedCount = 0;
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

        // 如果 JSON 中有 ID，使用该 ID
        if (club.id) {
          clubData._id = club.id;
        }

        await Club.create(clubData);
        insertedCount++;
      } catch (error) {
        console.warn(`⚠️ Failed to insert club: ${club.name}`, error.message);
      }
    }

    return res.json({
      success: true,
      message: 'JSON -> DB 替换完成',
      data: {
        total: insertedCount,
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
 * POST /api/sync/gitQuick
 * 快速 Git 操作：git add . -> git commit -> git pull -> git push
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
    const projectRoot = path.resolve(__dirname, '../../');

    try {
      // 1. git add .
      console.log('🔄 Running: git add .');
      await execAsync('git add .', { cwd: projectRoot });
      
      // 2. git commit -m "message"
      console.log(`🔄 Running: git commit -m "${message}"`);
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectRoot });
      
      // 3. git pull
      console.log('🔄 Running: git pull');
      await execAsync('git pull', { cwd: projectRoot });
      
      // 4. git push
      console.log('🔄 Running: git push');
      await execAsync('git push', { cwd: projectRoot });

      return res.json({
        success: true,
        message: 'Git 操作完成',
        data: {
          steps: ['git add .', `git commit -m "${message}"`, 'git pull', 'git push']
        }
      });

    } catch (error) {
      // 某些 git 操作可能返回 "no changes" 之类的警告但不是真正的错误
      if (error.code === 1 && (error.stderr.includes('nothing to commit') || error.stdout.includes('nothing to commit'))) {
        return res.json({
          success: true,
          message: 'Git 操作完成（无变更）',
          data: {
            steps: ['git add .', 'git commit (nothing to commit)', 'git pull', 'git push (nothing to push)']
          }
        });
      }

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

module.exports = router;
