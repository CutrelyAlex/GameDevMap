const express = require('express');
const router = express.Router();
const { upload, uploadMultiple, handleUploadError } = require('../middleware/upload');
const { apiLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/upload/logo
 * 上传社团 logo 图片
 * 
 * @body {File} logo - 图片文件（multipart/form-data）
 * @returns {Object} 上传结果和文件路径
 */
router.post('/logo', 
  apiLimiter,
  upload.single('logo'),
  handleUploadError,
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILE',
          message: '请选择要上传的文件'
        });
      }

      // 返回相对路径（前端可以直接使用）
      const filePath = `/assets/submissions/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: '文件上传成功',
        data: {
          path: filePath,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '文件上传失败，请稍后重试'
      });
    }
  }
);

/**
 * POST /api/upload/qrcode
 * 上传二维码图片（用于外部链接）
 * 
 * @body {File} qrcode - 图片文件（multipart/form-data）
 * @returns {Object} 上传结果和文件路径
 */
router.post('/qrcode', 
  apiLimiter,
  upload.single('qrcode'),
  handleUploadError,
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILE',
          message: '请选择要上传的文件'
        });
      }

      // 返回相对路径（前端可以直接使用）
      const filePath = `/assets/submissions/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: '二维码上传成功',
        data: {
          path: filePath,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error) {
      console.error('QR code upload error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '二维码上传失败，请稍后重试'
      });
    }
  }
);

/**
 * DELETE /api/upload/file
 * 删除已上传的文件（用于提交失败后的清理）
 * 
 * @query {string} filename - 要删除的文件名
 * @returns {Object} 删除结果
 */
router.delete('/file',
  apiLimiter,
  (req, res) => {
    try {
      const { filename } = req.query;
      
      if (!filename) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILENAME',
          message: '请提供要删除的文件名'
        });
      }

      // 安全检查：确保文件名不包含路径遍历字符
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FILENAME',
          message: '无效的文件名'
        });
      }

      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../..', 'public/assets/submissions', filename);

      // 确保文件在预期的目录中
      const uploadDir = path.join(__dirname, '../..', 'public/assets/submissions');
      if (!filePath.startsWith(uploadDir)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PATH',
          message: '无效的文件路径'
        });
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'FILE_NOT_FOUND',
          message: '文件不存在'
        });
      }

      // 删除文件
      fs.unlinkSync(filePath);

      res.status(200).json({
        success: true,
        message: '文件已删除'
      });
    } catch (error) {
      console.error('File deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '文件删除失败，请稍后重试'
      });
    }
  }
);

module.exports = router;
