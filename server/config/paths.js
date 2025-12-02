/**
 * 集中路径配置
 * 所有文件路径常量统一管理，避免硬编码
 */
const path = require('path');

// 项目根目录
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 数据目录
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const SUBMISSIONS_DIR = path.join(DATA_DIR, 'submissions');
const PENDING_DIR = path.join(DATA_DIR, 'pending_submissions');

// 公共资源目录
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
const LOGOS_DIR = path.join(ASSETS_DIR, 'logos');
const COMPRESSED_LOGOS_DIR = path.join(ASSETS_DIR, 'compressedLogos');
const QRCODES_DIR = path.join(ASSETS_DIR, 'qrcodes');
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, 'data');

// 数据文件
const CLUBS_JSON = path.join(PUBLIC_DATA_DIR, 'clubs.json');
const CLUBS_SCHEMA = path.join(PUBLIC_DATA_DIR, 'clubs.schema.json');

// 相对路径（用于 URL）
const URL_PATHS = {
  logos: '/assets/logos',
  compressedLogos: '/assets/compressedLogos',
  qrcodes: '/assets/qrcodes',
  submissions: '/assets/submissions'
};

module.exports = {
  PROJECT_ROOT,
  DATA_DIR,
  SUBMISSIONS_DIR,
  PENDING_DIR,
  PUBLIC_DIR,
  ASSETS_DIR,
  LOGOS_DIR,
  COMPRESSED_LOGOS_DIR,
  QRCODES_DIR,
  PUBLIC_DATA_DIR,
  CLUBS_JSON,
  CLUBS_SCHEMA,
  URL_PATHS
};
