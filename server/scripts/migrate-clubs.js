const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Club = require('../models/Club');

/**
 * Migration Script: clubs.json -> MongoDB
 * 
 * 读取 public/data/clubs.json 并导入到 MongoDB
 * 用于初始化数据库或同步静态数据到数据库
 */

async function migrateClubs() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 读取 clubs.json
    const clubsJsonPath = path.join(__dirname, '../../public/data/clubs.json');
    const data = await fs.readFile(clubsJsonPath, 'utf8');
    const clubs = JSON.parse(data);

    console.log(`📄 Found ${clubs.length} clubs in clubs.json`);

    // 第一步：完全删除数据库中的所有 Club 记录
    console.log('\n🗑️  Clearing database...');
    const deleteResult = await Club.deleteMany({});
    console.log(`  Deleted ${deleteResult.deletedCount} existing clubs`);

    let imported = 0;
    let skipped = 0;

    // 第二步：从 clubs.json 中导入所有数据
    console.log('\n📥 Importing from clubs.json...');
    for (const club of clubs) {
      try {
        // 支持两种坐标格式
        let coordinates;
        if (club.coordinates && Array.isArray(club.coordinates) && club.coordinates.length === 2) {
          // 使用 coordinates 数组 [lng, lat]
          coordinates = club.coordinates;
        } else if (club.longitude !== undefined && club.latitude !== undefined) {
          // 使用 longitude/latitude 字段 [lng, lat]
          coordinates = [club.longitude, club.latitude];
        } else {
          throw new Error('Missing coordinates data');
        }

        const clubData = {
          name: club.name,
          school: club.school,
          province: club.province,
          city: club.city || '',
          coordinates: coordinates, // [lng, lat]
          description: club.description || club.shortDescription || '',
          shortDescription: club.shortDescription || '',
          tags: club.tags || [],
          logo: club.logo || '',
          externalLinks: club.externalLinks || [],
          verifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // 创建新记录
        const newClub = new Club(clubData);
        await newClub.save();
        imported++;
        const linkInfo = clubData.externalLinks?.length > 0 ? ` (${clubData.externalLinks.length} links)` : '';
        console.log(`  ✓ Imported: ${club.name} (${club.school})${linkInfo}`);
      } catch (error) {
        console.error(`  ✗ Failed to import ${club.name}:`, error.message);
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log(`  ✓ Imported: ${imported}`);
    console.log(`  ✗ Skipped: ${skipped}`);
    console.log(`  📄 Total in JSON: ${clubs.length}`);
    console.log(`  💾 Total in DB: ${imported} (after migration)`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    console.log('\n✅ Migration complete');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateClubs();
}

module.exports = migrateClubs;
