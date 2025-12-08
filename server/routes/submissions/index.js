/**
 * 提交管理 - 路由定义
 * 拆分自原 submissions.js，业务逻辑移至 controller.js
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { validateSubmission } = require('../../middleware/validate');
const { submissionLimiter, apiLimiter } = require('../../middleware/rateLimiter');
const { authenticate } = require('../../middleware/auth');
const controller = require('./controller');

/**
 * POST /api/submissions - 提交新社团
 */
router.post('/', submissionLimiter, validateSubmission, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'SERVICE_UNAVAILABLE', message: '数据库连接暂时不可用' });
    }

    const metadata = {
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip,
      userAgent: req.headers['user-agent']
    };

    const submission = await controller.createSubmission(req.validatedData, metadata);

    res.status(201).json({
      success: true,
      message: '提交成功！预计 1-3 个工作日内完成审核',
      data: { submissionId: submission._id, estimatedReviewTime: '1-3 个工作日', status: submission.status }
    });
  } catch (error) {
    console.error('Submission error:', error);
    
    if (error.name === 'MongooseError' || error.message?.includes('MongoDB')) {
      return res.status(503).json({ success: false, error: 'SERVICE_UNAVAILABLE', message: '数据库连接暂时不可用' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false, error: 'VALIDATION_ERROR', message: '数据验证失败',
        errors: Object.values(error.errors).map(e => ({ field: e.path, message: e.message }))
      });
    }
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: '提交失败，请稍后重试' });
  }
});

/**
 * GET /api/submissions - 获取提交列表（管理员）
 */
router.get('/', apiLimiter, authenticate, async (req, res) => {
  try {
    const result = await controller.listSubmissions(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('List submissions failed:', error);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: '无法获取提交列表' });
  }
});

/**
 * GET /api/submissions/:id - 获取提交详情（管理员）
 */
router.get('/:id', apiLimiter, authenticate, async (req, res) => {
  try {
    const result = await controller.getSubmission(req.params.id);
    if (result.error === 'INVALID_ID') {
      return res.status(400).json({ success: false, error: 'INVALID_ID', message: '提交 ID 不合法' });
    }
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '未找到对应的提交记录' });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Get submission failed:', error);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: '获取提交详情失败' });
  }
});

/**
 * PUT /api/submissions/:id/approve - 批准提交（管理员）
 */
router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    const result = await controller.approveSubmission(req.params.id, req.user.username);
    
    if (result.error === 'INVALID_ID') {
      return res.status(400).json({ success: false, error: 'INVALID_ID', message: '提交 ID 不合法' });
    }
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '未找到对应的提交记录' });
    }
    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({ success: false, error: 'INVALID_STATUS', message: '仅待审核状态的提交可以被批准' });
    }

    return res.status(200).json({
      success: true,
      message: result.data.isUpdate ? '提交已批准并更新社团信息' : '提交已批准并生成社团记录',
      data: result.data
    });
  } catch (error) {
    console.error('Approve submission failed:', error);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: '批准失败，请稍后重试' });
  }
});

/**
 * PUT /api/submissions/:id/reject - 拒绝提交（管理员）
 */
router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    const result = await controller.rejectSubmission(req.params.id, req.user.username, req.body?.rejectionReason);
    
    if (result.error === 'INVALID_ID') {
      return res.status(400).json({ success: false, error: 'INVALID_ID', message: '提交 ID 不合法' });
    }
    if (result.error === 'MISSING_REASON') {
      return res.status(400).json({ success: false, error: 'MISSING_REASON', message: '请填写拒绝原因' });
    }
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '未找到对应的提交记录' });
    }
    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({ success: false, error: 'INVALID_STATUS', message: '仅待审核状态的提交可以被拒绝' });
    }

    return res.status(200).json({ success: true, message: '提交已拒绝，原因已记录', data: result.data });
  } catch (error) {
    console.error('Reject submission failed:', error);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: '拒绝失败，请稍后重试' });
  }
});

module.exports = router;
