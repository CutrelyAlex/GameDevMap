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

    let imported = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;

    // 创建一个 Set 来记录 clubs.json 中的社团（用 name+school 作为唯一标识）
    const jsonClubKeys = new Set();

    // 导入/更新每个社团
    for (const club of clubs) {
      try {
        // 生成唯一标识
        const clubKey = `${club.name}|${club.school}`;
        jsonClubKeys.add(clubKey);

        // 检查是否已存在（通过 name + school 判断）
        const existing = await Club.findOne({
          name: club.name,
          school: club.school
        });

        const clubData = {
          name: club.name,
          school: club.school,
          province: club.province,
          city: club.city || '',
          coordinates: [club.longitude, club.latitude], // [lng, lat]
          description: club.long_description || club.short_description || '',
          shortDescription: club.short_description || '',
          tags: club.tags || [],
          logo: club.img_name || '',
          website: club.website || '',
          contact: club.contact || {},
          verifiedBy: 'system',
          updatedAt: new Date()
        };

        if (existing) {
          // 更新现有记录
          await Club.findByIdAndUpdate(existing._id, clubData);
          updated++;
          console.log(`  ↻ Updated: ${club.name} (${club.school})`);
        } else {
          // 创建新记录
          const newClub = new Club({
            ...clubData,
            createdAt: new Date()
          });
          await newClub.save();
          imported++;
          console.log(`  ✓ Imported: ${club.name} (${club.school})`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to import ${club.name}:`, error.message);
        skipped++;
      }
    }

    // 删除数据库中存在但 clubs.json 中不存在的社团
    console.log('\n Checking for clubs to delete...');
    const allDbClubs = await Club.find({});
    
    for (const dbClub of allDbClubs) {
      const clubKey = `${dbClub.name}|${dbClub.school}`;
      
      if (!jsonClubKeys.has(clubKey)) {
        // 这个社团在数据库中存在，但在 clubs.json 中不存在，需要删除
        await Club.findByIdAndDelete(dbClub._id);
        deleted++;
        console.log(`  ✗  Deleted: ${dbClub.name} (${dbClub.school}) - not in clubs.json`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log(`  ✓ Imported: ${imported}`);
    console.log(`  ↻ Updated: ${updated}`);
    console.log(`  ✗ Deleted: ${deleted}`);
    console.log(`  -> Skipped: ${skipped}`);
    console.log(`  📄 Total in JSON: ${clubs.length}`);
    console.log(`  💾 Total in DB: ${clubs.length} (after sync)`);
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
