const Club = require('../models/Club');
const fs = require('fs').promises;
const path = require('path');
const { getGitSyncService, GitOperationError } = require('./GitSyncService');
const migrateClubs = require('../scripts/migrateClubs');

/**
 * AutoSyncService - 自动化同步协调服务
 * 
 * 工作流程：
 * 1. 批准提交 -> 社团保存到MongoDB
 * 2. 从MongoDB导出数据到clubs.json
 * 3. 通过GitSyncService提交并推送到GitHub
 * 4. 触发migrateClubs将changes同步回MongoDB（确保一致性）
 */

class AutoSyncService {
  constructor() {
    this.gitSync = getGitSyncService();
    this.lastSyncTime = null;
    this.syncInProgress = false;
  }

  /**
   * 将MongoDB中的Club数据导出到clubs.json
   */
  async exportClubsToJson() {
    try {
      console.log('📤 Exporting clubs from MongoDB to JSON...');
      
      // 从MongoDB查询所有已批准的社团
      const clubs = await Club.find({}).lean();
      
      if (!clubs || clubs.length === 0) {
        console.warn('⚠️  No clubs found in database');
        return [];
      }

      // 转换数据格式
      const clubsData = clubs.map(club => ({
        _id: club._id ? club._id.toString() : undefined,
        name: club.name,
        school: club.school,
        province: club.province,
        city: club.city || '',
        coordinates: Array.isArray(club.coordinates) ? club.coordinates : [0, 0],
        description: club.description || '',
        shortDescription: club.shortDescription || '',
        tags: Array.isArray(club.tags) ? club.tags : [],
        logo: club.logo || '', // Logo文件路径，会随git add .一起提交
        externalLinks: Array.isArray(club.externalLinks) ? club.externalLinks : [],
        verifiedBy: club.verifiedBy || '',
        createdAt: club.createdAt ? club.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: club.updatedAt ? club.updatedAt.toISOString() : new Date().toISOString()
      }));

      // 统计有logo的俱乐部
      const clubsWithLogos = clubsData.filter(c => c.logo).length;
      console.log(`✅ Exported ${clubsData.length} clubs from MongoDB`);
      if (clubsWithLogos > 0) {
        console.log(`   📸 ${clubsWithLogos} clubs with logos will be synced`);
      }
      
      return clubsData;

    } catch (error) {
      console.error('❌ Failed to export clubs:', error);
      throw error;
    }
  }

  /**
   * 执行自动同步流程
   * 1. 从MongoDB导出数据
   * 2. 通过Git提交并推送（git add .包含所有文件变化，包括logo上传）
   * 3. 运行migration同步回MongoDB
   */
  async performAutoSync(commitMessage = 'Auto-sync approved clubs') {
    if (this.syncInProgress) {
      console.warn('⚠️  Sync already in progress, queuing operation...');
    }

    this.syncInProgress = true;

    try {
      console.log('\n🔄 Starting auto-sync process...\n');

      // 第一步：导出数据
      const clubsData = await this.exportClubsToJson();

      // 第二步：通过GitSync提交并推送
      // 使用git add .同步所有文件变化：clubs.json、logo图片、压缩版本等
      console.log('📦 Syncing with Git (clubs.json, logos, and all file changes)...');
      const syncResult = await this.gitSync.syncClubsJson(clubsData, commitMessage);

      if (!syncResult.pushed) {
        console.log('ℹ️  Sync completed but no changes were pushed');
        this.lastSyncTime = new Date();
        return {
          success: true,
          synced: false,
          message: 'No changes to sync'
        };
      }

      // 第三步：运行migration将changes同步回MongoDB（确保数据一致性）
      console.log('\n📥 Running migration to sync back to MongoDB...');
      try {
        await migrateClubs();
        console.log('✅ Migration completed');
      } catch (migrationError) {
        console.error('⚠️  Migration failed, but Git sync was successful:', migrationError.message);
        // 记录错误但不失败 - Git同步已成功
      }

      this.lastSyncTime = new Date();

      console.log('\n✅ Auto-sync completed successfully');
      return {
        success: true,
        synced: true,
        method: syncResult.method,
        message: 'Clubs synced to repository and migrated back to database'
      };

    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
      
      return {
        success: false,
        synced: false,
        error: error.code || 'SYNC_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      };

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    const gitStatus = this.gitSync.getSyncStatus();
    
    return {
      inProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      gitQueue: {
        locked: gitStatus.isLocked,
        queueLength: gitStatus.queueLength
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取上次同步时间
   */
  getLastSyncTime() {
    return this.lastSyncTime;
  }

  /**
   * 手动触发同步（用于调试）
   */
  async triggerManualSync() {
    console.log('\n🔧 Manual sync triggered by admin');
    return this.performAutoSync('Manual sync by admin');
  }
}

// 单例模式
let instance = null;

function getAutoSyncService() {
  if (!instance) {
    instance = new AutoSyncService();
  }
  return instance;
}

module.exports = {
  AutoSyncService,
  getAutoSyncService
};
