const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Submission = require('../models/Submission');
const Club = require('../models/Club');
const { validateSubmission } = require('../middleware/validate');
const { submissionLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const syncToJson = require('../scripts/syncToJson');
const { findSimilarClubs } = require('../utils/duplicateCheck');
const { processApprovedImage } = require('../utils/imageProcessor');
const { getAutoSyncService } = require('../utils/AutoSyncService');
const fs = require('fs');
const path = require('path');

/**
 * 删除提交相关的Logo文件
 * @param {string} logoFilename - Logo文件名
 */
async function deleteSubmissionLogoFiles(logoFilename) {
  if (!logoFilename) return;

  const projectRoot = path.resolve(__dirname, '../..');
  const logoPath = path.join(projectRoot, 'data', 'submissions', logoFilename);

  try {
    await fs.promises.access(logoPath);
    await fs.promises.unlink(logoPath);
    console.log(`🗑️  Deleted submission logo file: ${logoPath}`);
  } catch (error) {
    // 文件不存在或删除失败，静默处理
    if (error.code !== 'ENOENT') {
      console.warn(`⚠️  Failed to delete submission logo file ${logoPath}:`, error.message);
    }
  }
}

/**
 * POST /api/submissions
 * 公开端点 - 提交新的社团信息
 * 
 * @body {Object} submission - 提交数据
 * @returns {Object} 提交成功信息
 */
router.post('/', 
  submissionLimiter,
  validateSubmission,
  async (req, res) => {
    try {
      // 检查数据库连接状态
      if (mongoose.connection.readyState !== 1) {
        console.error('❌ Database not connected, readyState:', mongoose.connection.readyState);
        return res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: '数据库连接暂时不可用，请稍后再试'
        });
      }

      // 提取客户端信息
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
      const userAgent = req.headers['user-agent'];

      // 坐标转换为 [经度, 纬度]
      const coordinates = req.validatedData.coordinates
        ? [
            Number(req.validatedData.coordinates.longitude),
            Number(req.validatedData.coordinates.latitude)
          ]
        : [];

      // 执行增强验证（异步，不阻塞提交）
      let duplicateResult = { passed: true, similarClubs: [] };

      try {
        // 重复检测
        duplicateResult = await findSimilarClubs(
          req.validatedData.name,
          req.validatedData.school,
          coordinates
        );
      } catch (validationError) {
        console.warn('Duplicate check failed:', validationError);
        // 验证失败不影响提交，继续处理
      }

      // 立即写入临时 JSON 
      try {
        const pendingDir = path.join(__dirname, '../../data/pending_submissions');
        if (!fs.existsSync(pendingDir)) {
          fs.mkdirSync(pendingDir, { recursive: true });
        }

        const tempObj = {
          timestamp: new Date().toISOString(),
          ipAddress,
          userAgent,
          duplicateCheck: duplicateResult,
          submission: {
            submitterEmail: req.validatedData.submitterEmail,
            data: req.validatedData,
            // logo is expected to be the frontend-uploaded path (e.g. /assets/submissions/filename)
            logo: req.validatedData.logo || ''
          }
        };

        const tempFilename = `${Date.now()}_${Math.random().toString(36).substring(2,10)}.json`;
        const tempPath = path.join(pendingDir, tempFilename);
        try {
          fs.writeFileSync(tempPath, JSON.stringify(tempObj, null, 2), { encoding: 'utf8' });
          console.info('Wrote pending submission JSON to', tempPath);
        } catch (writeErr) {
          console.warn('Failed to write pending submission JSON:', writeErr);
        }
      } catch (errPending) {
        console.warn('Unable to create pending_submissions directory or write file:', errPending);
      }

      // 创建提交记录
      const submissionData = {
        submissionType: req.validatedData.submissionType || 'new',
        submitterEmail: req.validatedData.submitterEmail,
        data: {
          name: req.validatedData.name,
          school: req.validatedData.school,
          province: req.validatedData.province,
          city: req.validatedData.city || '',
          coordinates,
          description: req.validatedData.description || req.validatedData.description || '',
          shortDescription: req.validatedData.shortDescription || '',
          tags: req.validatedData.tags || [],
          logo: req.validatedData.logo || '',
          externalLinks: req.validatedData.externalLinks || []
        },
        metadata: {
          ipAddress,
          userAgent,
          duplicateCheck: {
            passed: duplicateResult.passed,
            similarClubs: duplicateResult.similarClubs || []
          }
        }
      };

      // Add editing club ID and original data if in edit mode
      if (req.validatedData.submissionType === 'edit' && req.validatedData.editingClubId) {
        submissionData.editingClubId = req.validatedData.editingClubId;
        
        // Fetch original club data for comparison
        try {
          const Club = require('../models/Club');
          let originalClub = null;
          
          // Try to find by _id (if it's a valid ObjectId)
          if (mongoose.Types.ObjectId.isValid(req.validatedData.editingClubId)) {
            originalClub = await Club.findById(req.validatedData.editingClubId);
            
            if (originalClub) {
              console.log(`✓ Found original club by ID: ${originalClub.name} (${originalClub.school})`);
            }
          }
          
          // Fallback: Try to find by name + school if ID search failed
          if (!originalClub && req.validatedData.name && req.validatedData.school) {
            console.log(`Trying fallback: searching by name+school...`);
            originalClub = await Club.findOne({
              name: req.validatedData.name,
              school: req.validatedData.school
            });
            
            if (originalClub) {
              console.log(`✓ Found original club by name+school: ${originalClub.name}, _id: ${originalClub._id}`);
              // Update editingClubId to the correct MongoDB _id
              submissionData.editingClubId = originalClub._id.toString();
            }
          }
          
          if (originalClub) {
            submissionData.originalData = originalClub.toObject();
          } else {
            console.warn(`⚠️  Could not find original club for comparison`);
            console.warn(`   editingClubId: ${req.validatedData.editingClubId}`);
            console.warn(`   name: ${req.validatedData.name}`);
            console.warn(`   school: ${req.validatedData.school}`);
          }
        } catch (err) {
          console.warn('Error fetching original club data:', err);
        }
      }

      const submission = new Submission(submissionData);
      await submission.save();

      res.status(201).json({
        success: true,
        message: '提交成功！您的社团信息正在审核中，预计 1-3 个工作日内完成审核',
        data: {
          submissionId: submission._id,
          estimatedReviewTime: '1-3 个工作日',
          status: submission.status
        }
      });
    } catch (error) {
      console.error('❌ Submission error:', error);
      console.error('Error stack:', error.stack);
      
      // 记录失败的提交数据以便恢复
      console.error('Failed submission data:', JSON.stringify({
        timestamp: new Date().toISOString(),
        submitterEmail: req.validatedData?.submitterEmail,
        logo: req.validatedData?.logo,
        data: {
          name: req.validatedData?.name,
          school: req.validatedData?.school,
          province: req.validatedData?.province,
          city: req.validatedData?.city,
          description: req.validatedData?.description || req.validatedData?.description,
          shortDescription: req.validatedData?.shortDescription,
          tags: req.validatedData?.tags,
          coordinates: req.validatedData?.coordinates
        }
      }, null, 2));
      
      // 处理 MongoDB 连接错误
      if (error.name === 'MongooseError' || error.message?.includes('MongoDB') || error.message?.includes('ECONNREFUSED')) {
        return res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: '数据库连接暂时不可用，请稍后再试'
        });
      }

      // 处理数据库验证错误
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: '数据验证失败',
          errors: Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      // 通用服务器错误
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '提交失败，请稍后重试'
      });
    }
  }
);

// GET /api/submissions (admin)
router.get('/', apiLimiter, authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const sortParam = req.query.sort === 'asc' ? 1 : -1;
    const status = (req.query.status || '').toLowerCase();

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      Submission.find(filter)
        .sort({ submittedAt: sortParam })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Submission.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: total ? Math.ceil(total / limit) : 1
        }
      }
    });
  } catch (error) {
    console.error('List submissions failed:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '无法获取提交列表，请稍后重试'
    });
  }
});

// GET /api/submissions/:id (admin)
router.get('/:id', apiLimiter, authenticate, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ID',
      message: '提交 ID 不合法'
    });
  }

  try {
    const submission = await Submission.findById(id)
      .lean();

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '未找到对应的提交记录'
      });
    }

    return res.status(200).json({
      success: true,
      data: submission
    });
  } catch (error) {
    console.error('Get submission detail failed:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '获取提交详情失败，请稍后重试'
    });
  }
});

// PUT /api/submissions/:id/approve (admin)
router.put('/:id/approve', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ID',
      message: '提交 ID 不合法'
    });
  }

  try {
    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '未找到对应的提交记录'
      });
    }

    if (submission.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: 'INVALID_STATUS',
        message: '仅待审核状态的提交可以被批准'
      });
    }

    const coordinates = Array.isArray(submission.data.coordinates)
      ? submission.data.coordinates
      : [
          Number(submission.data.coordinates?.longitude) || 0,
          Number(submission.data.coordinates?.latitude) || 0
        ];

    // 处理图片：移动到 logos 目录并压缩
    let processedLogoFilename = submission.data.logo;
    
    // 判断是否需要处理图片
    // 对于编辑提交，检查图片是否来自新上传（在 submissions 目录）
    const needsImageProcessing = submission.data.logo && 
      (submission.submissionType !== 'edit' || 
       submission.data.logo.startsWith('/assets/submissions/'));
    
    if (needsImageProcessing) {
      try {
        processedLogoFilename = await processApprovedImage(submission.data.logo);
        console.log(`Processed logo: ${submission.data.logo} -> ${processedLogoFilename}`);
      } catch (imageError) {
        console.error('⚠️  Image processing failed, using original path:', imageError.message);
        // 继续流程，使用原始路径
      }
    } else if (submission.data.logo) {
      console.log(`Skipping image processing for existing logo: ${submission.data.logo}`);
    }

    let club;
    let isNewClub = true;

    // 检查是否是编辑提交
    if (submission.submissionType === 'edit' && submission.editingClubId) {
      // 编辑模式：更新现有社团
      console.log(`📝 Edit mode detected. Looking for club with ID: ${submission.editingClubId}`);
      
      // Try to find by _id if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(submission.editingClubId)) {
        console.log(`✓ Valid ObjectId format, searching by _id...`);
        club = await Club.findById(submission.editingClubId);
        
        if (club) {
          console.log(`✓ Found club: ${club.name} (${club.school})`);
        } else {
          console.warn(`✗ Club not found in database with _id: ${submission.editingClubId}`);
          // Try to find by name and school as fallback
          console.log(`Trying fallback: searching by name and school...`);
          club = await Club.findOne({
            name: submission.data.name,
            school: submission.data.school
          });
          
          if (club) {
            console.log(`✓ Found club by name+school: ${club.name} (${club.school}), _id: ${club._id}`);
          }
        }
      } else {
        console.warn(`✗ Invalid ObjectId format: ${submission.editingClubId}`);
      }
      
      if (club) {
        // 更新现有社团数据
        club.name = submission.data.name;
        club.school = submission.data.school;
        club.province = submission.data.province;
        club.city = submission.data.city;
        club.coordinates = coordinates;
        club.description = submission.data.description;
        club.shortDescription = submission.data.shortDescription || '';
        club.tags = submission.data.tags;
        club.logo = processedLogoFilename;
        club.externalLinks = submission.data.externalLinks || [];
        club.verifiedBy = req.user.username; // 记录最后审核人
        // updatedAt will be set automatically by the pre-save hook
        
        await club.save();
        isNewClub = false;
        console.log(`✅ Updated existing club ${club.id} from submission ${id}`);
      } else {
        console.warn(`⚠️  Could not find club to update, will create new club instead`);
      }
    }

    // 新建模式：创建新社团（或编辑模式下找不到原社团）
    if (!club) {
      club = new Club({
        name: submission.data.name,
        school: submission.data.school,
        province: submission.data.province,
        city: submission.data.city,
        coordinates,
        description: submission.data.description,
        shortDescription: submission.data.shortDescription || '',
        tags: submission.data.tags,
        logo: processedLogoFilename,
        externalLinks: submission.data.externalLinks || [],
        sourceSubmission: submission._id,
        verifiedBy: req.user.username
      });

      await club.save();
      console.log(`✅ Created new club ${club._id} from submission ${id}`);
    }

    submission.status = 'approved';
    submission.reviewedAt = new Date();
    submission.reviewedBy = req.user.username;
    submission.rejectionReason = undefined;
    await submission.save();

    // 异步触发自动同步流程（不阻塞响应）
    // 流程：导出 -> Git提交推送 -> 迁移回MongoDB -> 完整同步
    const autoSyncService = getAutoSyncService();
    autoSyncService.performAutoSync(
      `Approved submission: ${submission.data.name} (${submission.data.school})`
    ).then(syncResult => {
      if (syncResult.success) {
        console.log('✅ Auto-sync completed successfully');
      } else {
        console.error('❌ Auto-sync failed:', syncResult.message);
      }
    }).catch(err => {
      console.error('❌ Auto-sync error:', err);
    });

    return res.status(200).json({
      success: true,
      message: isNewClub ? '提交已批准并生成社团记录' : '提交已批准并更新社团信息',
      data: {
        submissionId: submission._id,
        clubId: club._id,
        isUpdate: !isNewClub,
        syncStatus: 'queued'
      }
    });
  } catch (error) {
    console.error('❌ Approve submission failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '批准失败，请稍后重试'
    });
  }
});

// PUT /api/submissions/:id/reject (admin)
router.put('/:id/reject', authenticate, async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ID',
      message: '提交 ID 不合法'
    });
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_REASON',
      message: '请填写拒绝原因'
    });
  }

  try {
    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '未找到对应的提交记录'
      });
    }

    if (submission.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: 'INVALID_STATUS',
        message: '仅待审核状态的提交可以被拒绝'
      });
    }

    submission.status = 'rejected';
    submission.reviewedAt = new Date();
    submission.reviewedBy = req.user.username;
    submission.rejectionReason = rejectionReason.trim().slice(0, 500);
    await submission.save();

    // 删除相关的Logo文件
    if (submission.data && submission.data.logo) {
      await deleteSubmissionLogoFiles(submission.data.logo);
    }

    return res.status(200).json({
      success: true,
      message: '提交已拒绝，原因已记录',
      data: {
        submissionId: submission._id
      }
    });
  } catch (error) {
    console.error('Reject submission failed:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: '拒绝失败，请稍后重试'
    });
  }
});

module.exports = router;
