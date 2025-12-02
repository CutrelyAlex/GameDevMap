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
