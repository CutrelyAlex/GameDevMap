/**
 * 全局配置与常量
 */

// 中国省份列表
const PROVINCES = [
  '北京市', '天津市', '上海市', '重庆市',
  '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
  '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '海南省',
  '四川省', '贵州省', '云南省', '陕西省', '甘肃省',
  '青海省', '台湾省',
  '内蒙古自治区', '广西壮族自治区', '西藏自治区',
  '宁夏回族自治区', '新疆维吾尔自治区',
  '香港特别行政区', '澳门特别行政区'
];

// API 端点
const API_ENDPOINTS = {
  upload_logo: '/api/upload/logo',
  upload_qrcode: '/api/upload/qrcode',
  submit: '/api/submissions',
  clubs_data: '/data/clubs.json'
};

// 限制配置
const LIMITS = {
  logo_max_size: 20 * 1024 * 1024, // 20MB
  qrcode_max_size: 5 * 1024 * 1024, // 5MB
  max_tags: 10,
  max_description_long: 1000,
  max_description_short: 200,
  max_links: 10
};

/**
 * 首页地图展示配置 - 用于 index.html
 * 包含地图初始化参数、资源路径、数据加载配置
 * script.js 使用这些配置来初始化高德地图和展示社团信息
 */
const MAP_CONFIG = {
  // 资源路径（logo 和占位符）
  LOGO_DIR: '/assets/compressedLogos/',           // Logo 压缩版本目录
  FALLBACK_LOGO_DIR: '/assets/logos/',            // Logo 备用目录
  PLACEHOLDER: '/assets/logos/placeholder.png',   // Logo 占位符
  
  // 数据加载配置
  DATA_PATH: '/api/clubs',                        // 动态 API 接口
  DATA_PATH_FALLBACK: '/data/clubs.json',         // 静态 JSON 备用
  
  // 地图显示配置
  DEFAULT_ZOOM: 5,                                // 默认缩放级别（显示全国）
  CENTER: [104.1954, 35.8617],                    // 默认中心点
  DETAIL_ZOOM: 13                                 // 社团详情展示的缩放级别
};
