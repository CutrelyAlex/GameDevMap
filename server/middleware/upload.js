const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 存放上传文件的目录 - 移动到 data/submissions
const uploadDir = path.join(__dirname, '../../data/submissions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成文件名: YYYY_MMDD_随机ID_类型.ext
    // 例如: 2025_1119_abc123_qrcode.png
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}_${month}${day}`;
    
    const randomId = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    
    // 根据字段名确定类型后缀
    let typeSuffix = 'file';
    if (file.fieldname === 'qrcode') {
      typeSuffix = 'qrcode';
    } else if (file.fieldname === 'logo') {
      typeSuffix = 'logo';
    }
    
    const filename = `${dateStr}_${randomId}_${typeSuffix}${ext}`;
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

// 创建 multer 实例 - 支持单个 logo 文件
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 1 // 一次只能上传一个文件
  }
});

// 创建 multer 实例 - 支持多个文件 (logo + QR codes)
const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 20 // Allow multiple files (1 logo + up to 19 QR codes)
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
  uploadMultiple,
  handleUploadError
};
