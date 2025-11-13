const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Club = require('../models/Club');
const { authenticate } = require('../middleware/auth');
const syncToJson = require('../scripts/syncToJson');

/**
 * 删除社团相关的Logo文件
 * @param {string} logoFilename - Logo文件名
 */
async function deleteClubLogoFiles(logoFilename) {
  if (!logoFilename) return;

  const projectRoot = path.resolve(__dirname, '../..');
  const logoPaths = [
    path.join(projectRoot, 'public', 'assets', 'logos', logoFilename),
    path.join(projectRoot, 'public', 'assets', 'compressedLogos', logoFilename)
  ];

  for (const logoPath of logoPaths) {
    try {
      await fs.access(logoPath);
      await fs.unlink(logoPath);
      console.log(`Deleted logo file: ${logoPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`ailed to delete logo file ${logoPath}:`, error.message);
      }
    }
  }
}

/**
 * GET /api/clubs
 * 公开端点 - 获取所有已批准的社团
 * 用于前端地图显示
 * 支持搜索功能
 * 
 * @query {string} search - 搜索关键词（可选）
 * @returns {Array} clubs - 社团列表
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    // 如果有搜索参数，添加搜索条件
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        $or: [
          { name: searchRegex },
          { school: searchRegex },
          { province: searchRegex },
          { city: searchRegex }
        ]
      };
    }

    const clubs = await Club.find(query)
      .select('-__v -sourceSubmission -verifiedBy')
      .sort({ createdAt: -1 })
      .limit(search ? 20 : undefined); // 搜索时限制结果数量

    // 转换为前端期望的格式
    const formattedClubs = clubs.map(club => ({
      id: club.id || club._id.toString(),
      name: club.name,
      school: club.school,
      city: club.city || '',
      province: club.province,
      latitude: club.coordinates[1],  // [lng, lat] -> lat
      longitude: club.coordinates[0], // [lng, lat] -> lng
      logo: club.logo || '',
      shortDescription: club.shortDescription || '',
      description: club.description || '',
      tags: club.tags || [],
      externalLinks: club.externalLinks || [],
      shortDescription: club.shortDescription || '',
      description: club.description || '',
      coordinates: club.coordinates,
      createdAt: club.createdAt,
      updatedAt: club.updatedAt
    }));

    return res.status(200).json({
      success: true,
      data: formattedClubs,
      total: formattedClubs.length
    });
  } catch (error) {
    console.error('Get clubs failed:', error);

    // 检查是否是数据库连接问题
    if (error.name === 'MongooseError' || error.message.includes('MongoDB') || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: '数据库连接暂时不可用，请稍后再试'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '获取社团列表失败'
    });
  }
});

/**
 * GET /api/clubs/:id
 * 公开端点 - 获取单个社团详情
 * 
 * @param {string} id - 社团ID
 * @returns {Object} club - 社团详情
 */
router.get('/:id', async (req, res) => {
  try {
    const club = await Club.findById(req.params.id)
      .select('-__v -sourceSubmission -verifiedBy');

    if (!club) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '未找到该社团'
      });
    }

    const formattedClub = {
      id: club._id.toString(),
      name: club.name,
      school: club.school,
      city: club.city || '',
      province: club.province,
      latitude: club.coordinates[1],
      longitude: club.coordinates[0],
      logo: club.logo || '',
      shortDescription: club.shortDescription || '',
      description: club.description || '',
      tags: club.tags || [],
      externalLinks: club.externalLinks || []
    };

    return res.status(200).json({
      success: true,
      data: formattedClub
    });
  } catch (error) {
    console.error('Get club failed:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '获取社团详情失败'
    });
  }
});

/**
 * PUT /api/clubs/:id
 * 管理员端点 - 编辑社团信息
 * 
 * @param {string} id - 社团ID
 * @body {Object} 更新数据（支持：name, school, province, city, coordinates, description, shortDescription, tags, externalLinks）
 * @returns {Object} 更新结果
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body || {};

    const club = await Club.findById(id);

    if (!club) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '未找到该社团'
      });
    }

    // 允许更新的字段
    const allowedFields = [
      'name', 'school', 'province', 'city', 
      'description', 'shortDescription', 
      'tags', 'externalLinks', 'coordinates'
    ];

    // 更新允许的字段
    allowedFields.forEach(field => {
      if (field in updateData && updateData[field] !== undefined) {
        club[field] = updateData[field];
      }
    });

    await club.save();

    console.log(`✏️ Updated club: ${club.name} (${club.school}) by ${req.user.username}`);

    // 自动同步到 clubs.json
    syncToJson().catch(err => {
      console.error('⚠️  Failed to sync clubs.json after update:', err);
    });

    return res.status(200).json({
      success: true,
      message: '社团已更新',
      data: {
        id: club._id.toString(),
        name: club.name,
        school: club.school,
        updatedAt: club.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Update club failed:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '更新社团失败'
    });
  }
});

/**
 * DELETE /api/clubs/:id
 * 管理员端点 - 删除社团
 * 
 * @param {string} id - 社团ID
 * @returns {Object} 删除结果
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const club = await Club.findById(id);

    if (!club) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '未找到该社团'
      });
    }

    // 保存社团信息用于日志
    const clubInfo = `${club.name} (${club.school})`;

    // 删除相关的Logo文件
    if (club.logo) {
      await deleteClubLogoFiles(club.logo);
    }

    // 删除社团
    await Club.findByIdAndDelete(id);

    console.log(`🗑️  Deleted club: ${clubInfo} by ${req.user.username}`);

    // 自动同步到 clubs.json
    syncToJson().catch(err => {
      console.error('⚠️  Failed to sync clubs.json after deletion:', err);
    });

    return res.status(200).json({
      success: true,
      message: '社团已删除',
      data: {
        id,
        name: clubInfo
      }
    });
  } catch (error) {
    console.error('❌ Delete club failed:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '删除社团失败'
    });
  }
});

module.exports = router;
