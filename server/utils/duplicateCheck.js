const Club = require('../models/Club');

/**
 * 计算两点之间的距离（使用Haversine公式）
 * @param {number} lat1 - 纬度1
 * @param {number} lon1 - 经度1
 * @param {number} lat2 - 纬度2
 * @param {number} lon2 - 经度2
 * @returns {number} 距离（公里）
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Duplicate Detection Utility
 * 
 * 检测相似或重复的社团提交
 */

/**
 * 查找相似的社团
 * 
 * @param {string} name - 社团名称
 * @param {string} school - 学校名称
 * @param {Array<number>} coordinates - [经度, 纬度]
 * @returns {Promise<{passed: boolean, similarClubs: Array}>}
 */
async function findSimilarClubs(name, school, coordinates = null) {
  try {
    // 直接返回通过，不进行重复检查
    return {
      passed: true,
      similarClubs: [],
      totalFound: 0
    };

    // 以下代码被注释掉，不再执行重复检查
    /*
    const similarClubs = [];

    // 1. 检查完全相同的 name + school 组合
    const exactMatch = await Club.findOne({
      name: name.trim(),
      school: school.trim()
    });

    if (exactMatch) {
      similarClubs.push({
        id: exactMatch._id.toString(),
        name: exactMatch.name,
        school: exactMatch.school,
        matchType: 'exact',
        confidence: 1.0
      });
    }

    // 2. 使用文本搜索查找相似名称
    const textMatches = await Club.find({
      $or: [
        { name: new RegExp(escapeRegex(name), 'i') },
        { school: new RegExp(escapeRegex(school), 'i') }
      ]
    }).limit(10);

    for (const club of textMatches) {
      // 跳过已经添加的exact match
      if (exactMatch && club._id.equals(exactMatch._id)) {
        continue;
      }

      const nameSimilarity = calculateStringSimilarity(name, club.name);
      const schoolSimilarity = calculateStringSimilarity(school, club.school);
      
      // 名称相似度 > 70% 或 学校相同且名称相似度 > 50%
      if (nameSimilarity > 0.7 || (schoolSimilarity > 0.9 && nameSimilarity > 0.5)) {
        similarClubs.push({
          id: club._id.toString(),
          name: club.name,
          school: club.school,
          matchType: 'similar',
          confidence: (nameSimilarity + schoolSimilarity) / 2
        });
      }
    }

    // 3. 如果提供了坐标，检查地理位置接近的社团（1公里内）
    if (coordinates && coordinates.length === 2) {
      const nearbyClubs = await Club.find({
        coordinates: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: coordinates
            },
            $maxDistance: 1000 // 1公里
          }
        }
      }).limit(5);

      for (const club of nearbyClubs) {
        // 检查是否已经添加
        const alreadyAdded = similarClubs.some(c => c.id === club._id.toString());
        if (alreadyAdded) {
          continue;
        }

        const distance = calculateDistance(
          coordinates[1], coordinates[0],
          club.coordinates[1], club.coordinates[0]
        );

        similarClubs.push({
          id: club._id.toString(),
          name: club.name,
          school: club.school,
          matchType: 'nearby',
          distance: Math.round(distance * 1000), // 转换为米
          confidence: 1 - (distance / 1) // 距离越近，置信度越高
        });
      }
    }

    // 按置信度排序
    similarClubs.sort((a, b) => b.confidence - a.confidence);

    return {
      passed: similarClubs.length === 0,
      similarClubs: similarClubs.slice(0, 5), // 最多返回5个
      totalFound: similarClubs.length
    };
    */

  } catch (error) {
    console.error('Duplicate check failed:', error);
    return {
      passed: true, // 失败时默认通过，不阻止提交
      similarClubs: [],
      error: error.message
    };
  }
}

/**
 * 计算两个字符串的相似度（Levenshtein距离）
 * 
 * @param {string} str1
 * @param {string} str2
 * @returns {number} 0-1之间的相似度
 */
function calculateStringSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * 计算Levenshtein距离
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  findSimilarClubs,
  calculateStringSimilarity
};
