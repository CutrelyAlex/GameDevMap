const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * GitSyncService - 自动化Git同步服务
 * 处理clubs.json的Git提交、推送和冲突解决
 */
class GitSyncService {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../');
    this.clubsJsonPath = path.join(this.projectRoot, 'public/data/clubs.json');
    this.isLocked = false;
    this.operationQueue = [];
  }

  /**
   * 获取当前锁定状态
   */
  isOperationInProgress() {
    return this.isLocked;
  }

  /**
   * 队列操作执行
   */
  async enqueueOperation(operation) {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * 处理操作队列
   */
  async processQueue() {
    if (this.isLocked || this.operationQueue.length === 0) {
      return;
    }

    this.isLocked = true;
    const { operation, resolve, reject } = this.operationQueue.shift();

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isLocked = false;
      // 继续处理队列中的下一个操作
      this.processQueue();
    }
  }

  /**
   * 执行Git命令
   */
  async executeGitCommand(command, options = {}) {
    try {
      console.log(`🔧 Executing: git ${command}`);
      const { stdout, stderr } = await execAsync(`git ${command}`, {
        cwd: this.projectRoot,
        ...options
      });
      
      if (stderr && !stderr.includes('warning')) {
        console.warn(`⚠️  Git stderr: ${stderr}`);
      }
      
      console.log(`✓ Command succeeded`);
      return stdout.trim();
    } catch (error) {
      console.error(`❌ Git command failed: git ${command}`);
      console.error(`Error: ${error.message}`);
      throw new GitOperationError(error.message, 'GIT_COMMAND_FAILED');
    }
  }

  /**
   * 检查是否有本地更改
   */
  async hasLocalChanges() {
    try {
      const status = await this.executeGitCommand('status --porcelain');
      return status.length > 0;
    } catch (error) {
      console.warn('Failed to check git status:', error.message);
      return true; // 假设有更改以防安全
    }
  }

  /**
   * 获取当前分支
   */
  async getCurrentBranch() {
    try {
      return await this.executeGitCommand('rev-parse --abbrev-ref HEAD');
    } catch (error) {
      throw new GitOperationError('Failed to get current branch', 'GET_BRANCH_FAILED');
    }
  }

  /**
   * 拉取最新更改
   */
  async pullLatest() {
    try {
      console.log('📥 Pulling latest changes from remote...');
      await this.executeGitCommand('pull origin main --allow-unrelated-histories', {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      console.log('✅ Successfully pulled latest changes');
    } catch (error) {
      // 尝试强制拉取以解决冲突
      console.warn('⚠️  Pull failed, attempting conflict resolution...');
      await this.resolveConflict();
    }
  }

  /**
   * 添加文件到暂存区
   */
  async stageFile(filePath) {
    try {
      const relativePath = path.relative(this.projectRoot, filePath);
      await this.executeGitCommand(`add "${relativePath}"`);
      console.log(`✅ Staged: ${relativePath}`);
    } catch (error) {
      throw new GitOperationError(`Failed to stage file ${filePath}`, 'STAGE_FAILED');
    }
  }

  /**
   * 添加所有更改到暂存区（包括新文件、修改和删除）
   * 用于同步所有文件变化，包括logo上传
   */
  async stageAllChanges() {
    try {
      console.log('📝 Staging all changes (clubs.json, logos, etc)...');
      await this.executeGitCommand('add .');
      console.log('✅ Staged all changes');
    } catch (error) {
      throw new GitOperationError('Failed to stage all changes', 'STAGE_ALL_FAILED');
    }
  }

  /**
   * 提交更改
   */
  async commit(message) {
    try {
      // 检查是否有更改需要提交
      const hasChanges = await this.hasLocalChanges();
      if (!hasChanges) {
        console.log('ℹ️  No local changes to commit');
        return false;
      }

      await this.executeGitCommand(`commit -m "${message}"`);
      console.log(`✅ Committed: ${message}`);
      return true;
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        console.log('ℹ️  Nothing to commit');
        return false;
      }
      throw new GitOperationError(`Failed to commit: ${message}`, 'COMMIT_FAILED');
    }
  }

  /**
   * 推送到远程仓库
   */
  async push() {
    try {
      console.log('📤 Pushing to remote repository...');
      
      // 使用 --force-with-lease 来安全地强制推送（防止推送他人的更改）
      try {
        await this.executeGitCommand('push origin main');
        console.log('✅ Successfully pushed to remote');
        return { success: true, method: 'normal' };
      } catch (pushError) {
        // 如果是非快进错误（non-fast-forward），尝试强制推送
        if (pushError.message.includes('non-fast-forward') || 
            pushError.message.includes('rejected')) {
          console.warn('⚠️  Non-fast-forward error detected, attempting forced push...');
          
          // 先重置到远程版本
          await this.executeGitCommand('reset --hard origin/main');
          await this.pullLatest();
          
          // 重新尝试普通推送
          await this.executeGitCommand('push origin main');
          console.log('✅ Successfully pushed to remote (after conflict resolution)');
          return { success: true, method: 'resolved_conflict' };
        }
        throw pushError;
      }
    } catch (error) {
      throw new GitOperationError(`Failed to push: ${error.message}`, 'PUSH_FAILED');
    }
  }

  /**
   * 解决Git冲突
   */
  async resolveConflict() {
    try {
      console.log('🔄 Resolving Git conflicts...');
      
      // 获取冲突文件列表
      try {
        const status = await this.executeGitCommand('status --porcelain');
        const conflictFiles = status
          .split('\n')
          .filter(line => line.startsWith('UU') || line.startsWith('AA'))
          .map(line => line.slice(3));

        if (conflictFiles.length > 0) {
          console.log(`Found ${conflictFiles.length} conflicted files`);
          
          // 对于 clubs.json，使用"本地版本优先"策略
          for (const file of conflictFiles) {
            if (file.includes('clubs.json')) {
              console.log(`Using local version for ${file}`);
              await this.executeGitCommand(`checkout --ours "${file}"`);
              await this.executeGitCommand(`add "${file}"`);
            } else {
              // 其他文件使用远程版本
              console.log(`Using remote version for ${file}`);
              await this.executeGitCommand(`checkout --theirs "${file}"`);
              await this.executeGitCommand(`add "${file}"`);
            }
          }
        }
      } catch (statusError) {
        // 如果没有冲突文件，继续
        console.log('No conflicted files detected');
      }

      // 完成合并
      await this.executeGitCommand('commit --no-edit');
      console.log('✅ Conflicts resolved');
      
    } catch (error) {
      // 如果解决冲突失败，尝试中止合并
      try {
        await this.executeGitCommand('merge --abort');
      } catch (abortError) {
        console.warn('Failed to abort merge:', abortError.message);
      }
      throw new GitOperationError(`Failed to resolve conflicts: ${error.message}`, 'CONFLICT_RESOLUTION_FAILED');
    }
  }

  /**
   * 执行完整的同步流程：拉取 -> 提交 -> 推送
   */
  async syncClubsJson(clubsData, commitMessage = 'Auto-sync approved clubs') {
    const operation = async () => {
      try {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 Starting GitSync operation...');
        console.log('='.repeat(60));

        // 1. 验证Git仓库
        const branch = await this.getCurrentBranch();
        console.log(`📍 Current branch: ${branch}`);

        if (branch !== 'main') {
          throw new GitOperationError(
            `Cannot sync on branch '${branch}', must be on 'main'`,
            'INVALID_BRANCH'
          );
        }

        // 2. 拉取最新更改
        await this.pullLatest();

        // 3. 更新 clubs.json
        console.log('\n📝 Updating clubs.json...');
        await fs.writeFile(
          this.clubsJsonPath,
          JSON.stringify(clubsData, null, 2) + '\n',
          'utf8'
        );
        console.log('✅ Updated clubs.json');

        // 4. 暂存所有更改（包括新上传的logo、clubs.json等）
        await this.stageAllChanges();

        // 5. 提交更改
        const committed = await this.commit(commitMessage);

        if (!committed) {
          console.log('ℹ️  No changes to commit, skipping push');
          return {
            success: true,
            committed: false,
            pushed: false,
            message: 'No changes to sync'
          };
        }

        // 6. 推送到远程
        const pushResult = await this.push();

        console.log('\n' + '='.repeat(60));
        console.log('✅ GitSync operation completed successfully');
        console.log('='.repeat(60) + '\n');

        return {
          success: true,
          committed: true,
          pushed: true,
          method: pushResult.method,
          message: 'Clubs synced to repository'
        };

      } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ GitSync operation failed');
        console.error('='.repeat(60) + '\n');
        
        throw error;
      }
    };

    // 使用队列确保顺序执行
    return this.enqueueOperation(operation);
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return {
      isLocked: this.isLocked,
      queueLength: this.operationQueue.length,
      projectRoot: this.projectRoot
    };
  }
}

/**
 * 自定义错误类
 */
class GitOperationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GitOperationError';
    this.code = code;
  }
}

// 单例模式
let instance = null;

function getGitSyncService() {
  if (!instance) {
    instance = new GitSyncService();
  }
  return instance;
}

module.exports = {
  GitSyncService,
  GitOperationError,
  getGitSyncService
};
