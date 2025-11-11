const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Submission = require('../models/Submission');
const Club = require('../models/Club');
const { validateSubmission } = require('../middleware/validate');
const { submissionLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');

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

      // 创建提交记录
      const submission = new Submission({
        submitterEmail: req.validatedData.submitterEmail,
        data: {
          name: req.validatedData.name,
          school: req.validatedData.school,
          province: req.validatedData.province,
          city: req.validatedData.city || '',
          coordinates,
          description: req.validatedData.long_description || req.validatedData.description || '',
          tags: req.validatedData.tags || [],
          logo: req.validatedData.logo || '',
          website: '',
          contact: {}
        },
        metadata: {
          ipAddress,
          userAgent,
          geocodingVerified: false, // 将在 Phase 6 实现
          duplicateCheck: {
            passed: true,
            similarClubs: []
          }
        }
      });

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
      console.error('Submission error:', error);
      
      // 处理数据库错误
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
      .populate('metadata.duplicateCheck.similarClubs')
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

    const club = new Club({
      name: submission.data.name,
      school: submission.data.school,
      province: submission.data.province,
      city: submission.data.city,
      coordinates,
      description: submission.data.description,
      tags: submission.data.tags,
      logo: submission.data.logo,
      website: submission.data.website,
      contact: submission.data.contact,
      sourceSubmission: submission._id,
      verifiedBy: req.user.username
    });

    await club.save();

    submission.status = 'approved';
    submission.reviewedAt = new Date();
    submission.reviewedBy = req.user.username;
    submission.rejectionReason = undefined;
    await submission.save();

    return res.status(200).json({
      success: true,
      message: '提交已批准并生成社团记录',
      data: {
        submissionId: submission._id,
        clubId: club._id
      }
    });
  } catch (error) {
    console.error('Approve submission failed:', error);
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
