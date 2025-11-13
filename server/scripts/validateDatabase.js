#!/usr/bin/env node

/**
 * 验证脚本：检查数据库中是否存在废弃字段和 external_links 同步状态
 * 
 * 用法：npm run validate:db
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const Club = require('../models/Club');

async function validateDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 读取 clubs.json
    const clubsJsonPath = path.join(__dirname, '../../public/data/clubs.json');
    const jsonData = await fs.readFile(clubsJsonPath, 'utf8');
    const jsonClubs = JSON.parse(jsonData);

    console.log('📊 Database Validation Report');
    console.log('='.repeat(70));

    const clubs = await Club.find({}).lean();
    
    let hasIssues = false;
    let deprecatedFieldsFound = 0;
    let linksNotSynced = 0;

    for (const dbClub of clubs) {
      let clubHasIssues = false;
      const issues = [];

      // 检查废弃字段
      if (dbClub.website !== undefined || dbClub.contact !== undefined) {
        clubHasIssues = true;
        deprecatedFieldsFound++;
        if (dbClub.website !== undefined) {
          issues.push(`website: "${dbClub.website}"`);
        }
        if (dbClub.contact !== undefined) {
          issues.push(`contact: ${JSON.stringify(dbClub.contact)}`);
        }
      }

      // 查找对应的 JSON 数据
      const jsonClub = jsonClubs.find(c => c.name === dbClub.name && c.school === dbClub.school);
      if (jsonClub) {
        const jsonLinks = JSON.stringify(jsonClub.external_links || []);
        const dbLinks = JSON.stringify(dbClub.external_links || []);
        
        if (jsonLinks !== dbLinks) {
          clubHasIssues = true;
          linksNotSynced++;
          issues.push(`external_links mismatch:\n    JSON: ${jsonLinks}\n    DB:   ${dbLinks}`);
        }
      }

      if (clubHasIssues) {
        hasIssues = true;
        console.log(`\n❌ ${dbClub.name} (${dbClub.school})`);
        issues.forEach(issue => {
          console.log(`   ⚠️  ${issue}`);
        });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('Summary:');
    console.log(`  Total clubs in DB: ${clubs.length}`);
    console.log(`  Clubs with deprecated fields: ${deprecatedFieldsFound}`);
    console.log(`  Clubs with mismatched external_links: ${linksNotSynced}`);

    if (hasIssues) {
      console.log('\n❌ Issues found! Run: npm run migrate:clubs');
      console.log('='.repeat(70));
      await mongoose.disconnect();
      process.exit(1);
    } else {
      console.log('\n✅ Database is clean and consistent!');
      console.log('='.repeat(70));
      await mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  validateDatabase();
}

module.exports = validateDatabase;
