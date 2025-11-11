const mongoose = require('mongoose');
require('dotenv').config();

const Club = require('../models/Club');
const { processApprovedImage } = require('../utils/imageProcessor');

/**
 * Migration Script: Process existing images
 * 
 * 处理现有的 Club logo:
 * 1. 如果 logo 是完整路径（/assets/submissions/xxx），移动到 logos 并压缩
 * 2. 更新数据库记录为仅文件名
 */

async function migrateExistingImages() {
  try {
    console.log('🔄 Starting image migration...');

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 查找所有有 logo 的社团
    const clubs = await Club.find({ logo: { $exists: true, $ne: '' } });
    console.log(`📊 Found ${clubs.length} clubs with logos`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const club of clubs) {
      try {
        // 如果 logo 包含路径，需要处理
        if (club.logo.includes('/') || club.logo.startsWith('data/submissions/')) {
          console.log(`\n🔄 Processing: ${club.name} (${club._id})`);
          console.log(`   Original logo: ${club.logo}`);

          const processedFilename = await processApprovedImage(club.logo);

          // 更新数据库
          club.logo = processedFilename;
          await club.save();

          console.log(`   ✅ Updated to: ${processedFilename}`);
          processed++;
        } else {
          // 已经是文件名格式，跳过
          console.log(`⏭️  Skipping: ${club.name} (already filename: ${club.logo})`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${club.name}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Processed: ${processed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateExistingImages();
