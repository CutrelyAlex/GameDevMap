/**
 * 同步模块 - 辅助函数
 */
const fs = require('fs').promises;
const Club = require('../../models/Club');
const { CLUBS_JSON } = require('../../config/paths');

/**
 * 格式化社团为统一输出格式
 */
function formatClub(club) {
  const externalLinks = (club.externalLinks || []).map(link => ({
    type: link.type,
    url: link.url
  }));

  return {
    name: club.name,
    school: club.school,
    city: club.city || '',
    province: club.province,
    coordinates: club.coordinates || [0, 0],
    logo: club.logo || '',
    shortDescription: club.shortDescription || '',
    description: club.description || '',
    tags: club.tags || [],
    externalLinks
  };
}

/**
 * 读取 clubs.json
 */
async function readClubsJson() {
  try {
    const data = await fs.readFile(CLUBS_JSON, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * 写入 clubs.json
 */
async function writeClubsJson(clubs) {
  await fs.writeFile(CLUBS_JSON, JSON.stringify(clubs, null, 2), 'utf-8');
}

/**
 * 查找两个对象差异
 */
function findDifferences(obj1, obj2) {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
    const clean1 = removeIds(obj1[key]);
    const clean2 = removeIds(obj2[key]);
    if (JSON.stringify(clean1) !== JSON.stringify(clean2)) {
      differences.push({ field: key, database: obj1[key], json: obj2[key] });
    }
  }
  return differences;
}

/**
 * 递归移除 _id 字段
 */
function removeIds(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeIds);
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key !== '_id') cleaned[key] = removeIds(value);
  }
  return cleaned;
}

/**
 * 检测重复记录
 */
function detectDuplicates(dbClubs, jsonClubs) {
  const groups = [];
  
  // 按 name+school 检测
  const nameSchoolMap = new Map();
  [...dbClubs, ...jsonClubs].forEach((club, _, arr) => {
    const key = `${club.name?.toLowerCase()?.trim()}-${club.school?.toLowerCase()?.trim()}`;
    const source = dbClubs.includes(club) ? 'database' : 'json';
    if (!nameSchoolMap.has(key)) nameSchoolMap.set(key, []);
    nameSchoolMap.get(key).push({ identifier: `${club.name}|${club.school}`, name: club.name, school: club.school, source });
  });

  for (const [key, records] of nameSchoolMap) {
    const sources = new Set(records.map(r => r.source));
    if (sources.size === 1 && records.length > 1) {
      groups.push({ criteria: '名称 + 学校', key, records });
    }
  }

  return groups;
}

/**
 * 导入单个社团到数据库
 */
async function importClubToDb(club) {
  let coordinates;
  if (club.coordinates?.length === 2) {
    coordinates = club.coordinates;
  } else if (club.longitude !== undefined && club.latitude !== undefined) {
    coordinates = [club.longitude, club.latitude];
  } else {
    throw new Error('Missing coordinates');
  }

  const newClub = new Club({
    name: club.name,
    school: club.school,
    province: club.province,
    city: club.city || '',
    coordinates,
    description: club.description || club.shortDescription || '',
    shortDescription: club.shortDescription || '',
    tags: club.tags || [],
    logo: club.logo || '',
    externalLinks: club.externalLinks || [],
    verifiedBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  await newClub.save();
  return newClub;
}

module.exports = {
  formatClub,
  readClubsJson,
  writeClubsJson,
  findDifferences,
  removeIds,
  detectDuplicates,
  importClubToDb
};
