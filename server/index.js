const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for simplicity
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/upload', require('./routes/upload'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Catch-all for SPA routing (serve index.html for any non-API routes)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'API endpoint not found'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: '请求参数验证失败',
      details: errors
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_ERROR',
      message: '数据已存在'
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Token 无效'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'TOKEN_EXPIRED',
      message: 'Token 已过期'
    });
  }
  
  // Default server error
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Map view: http://localhost:${PORT}`);
});

module.exports = app;
