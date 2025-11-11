const express = require('express');
const router = express.Router();
const { upload, handleUploadError } = require('../middleware/upload');
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

module.exports = router;
