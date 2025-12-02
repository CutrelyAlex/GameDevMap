/**
 * 全局工具函数库 - 被 submit.js 使用
 * 
 * 提供可复用的通用工具函数，主要包括：
 *   - HTML 转义防 XSS：escapeHtmlAttr() - 处理 HTML 属性值
 *   - 标签解析：parseTags() - 将逗号/换行分隔的字符串解析为数组
 *   - 坐标校验：validateCoordinates() - 验证经纬度格式
 *   - 文件校验：validateLogoFile() - 验证 Logo 文件格式和大小
 *   - 文件上传：uploadLogo(), uploadQRCode() - 处理图片上传
 * 
 * 依赖模块：config.js (API_ENDPOINTS, LIMITS)
 * 依赖函数：addDebugLog() (由 submit.html 中的 debug-panel.js 提供)
 */

/**
 * HTML 属性转义
 * @param {string} text
 * @returns {string}
 */
function escapeHtmlAttr(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 解析用户输入的标签（逗号或换行分隔）
 * @param {string} raw - 原始输入
 * @returns {string[]} 标签数组
 * @throws {Error} 标签数量超过限制
 */
function parseTags(raw) {
  if (!raw) {
    return [];
  }

  const tags = raw
    .split(/[,，\n]/)
    .map(tag => tag.trim())
    .filter(Boolean);

  if (tags.length > LIMITS.max_tags) {
    throw new Error(`标签数量最多 ${LIMITS.max_tags} 个，请删除多余的标签`);
  }

  return tags;
}

/**
 * 校验经纬度范围
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @throws {Error} 坐标无效
 */
function validateCoordinates(lat, lng) {
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error('请填写有效的经纬度坐标');
  }
  if (lat < -90 || lat > 90) {
    throw new Error('纬度必须在 -90 到 90 之间');
  }
  if (lng < -180 || lng > 180) {
    throw new Error('经度必须在 -180 到 180 之间');
  }
}

/**
 * 校验 Logo 文件
 * @param {File} file
 * @returns {boolean} 是否合法
 */
function validateLogoFile(file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
  
  if (!allowedTypes.includes(file.type)) {
    showStatus('Logo 文件格式不正确，请使用 PNG、JPG、GIF 或 SVG 格式', 'error');
    return false;
  }
  
  if (file.size > LIMITS.logo_max_size) {
    showStatus(`Logo 文件大小不能超过 ${LIMITS.logo_max_size / (1024 * 1024)}MB`, 'error');
    return false;
  }
  
  return true;
}

/**
 * 上传 Logo 文件
 * @param {File|undefined} file
 * @returns {Promise<string>} 文件路径
 * @throws {Error} 上传失败
 */
async function uploadLogo(file) {
  if (!file) {
    return '';
  }

  if (!validateLogoFile(file)) {
    throw new Error('Logo 文件校验失败');
  }

  const formData = new FormData();
  formData.append('logo', file);

  const response = await fetch(API_ENDPOINTS.upload_logo, {
    method: 'POST',
    body: formData
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Logo 上传失败，请稍后再试');
  }

  return result.data.path;
}

/**
 * 上传二维码文件
 * @param {File} file
 * @returns {Promise<string>} 文件路径
 * @throws {Error} 上传失败
 */
async function uploadQRCode(file) {
  if (!file) {
    return '';
  }

  const formData = new FormData();
  formData.append('qrcode', file);

  const response = await fetch(API_ENDPOINTS.upload_qrcode, {
    method: 'POST',
    body: formData
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || '二维码上传失败，请稍后再试');
  }

  return result.data.path;
}
