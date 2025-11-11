const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../public/assets/submissions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成文件名: YYYYMMDD_随机ID_原始名称
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomId = Math.random().toString(36).substring(2, 10);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') // 清理特殊字符
      .substring(0, 50); // 限制长度
    
    const filename = `${date}_${randomId}_${basename}${ext}`;
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许的 MIME 类型
  const allowedMimes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/svg+xml'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型。请上传 PNG、JPG、GIF 或 SVG 格式的图片'), false);
  }
};

// 创建 multer 实例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 1 // 一次只能上传一个文件
  }
});

// 错误处理中间件
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer 特定错误
    let message = '文件上传失败';
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = '文件大小超过限制（最大 20MB）';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = '一次只能上传一个文件';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = '不支持的文件字段名';
    }

    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message
    });
  } else if (err) {
    // 其他错误（如文件类型错误）
    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message: err.message
    });
  }

  next();
};

module.exports = {
  upload,
  handleUploadError
};
