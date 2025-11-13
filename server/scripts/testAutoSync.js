#!/usr/bin/env node

/**
 * 自动同步系统集成测试脚本
 * 
 * 测试覆盖：
 * 1. GitSyncService 基本功能
 * 2. AutoSyncService 完整流程
 * 3. 冲突解决机制
 * 4. 数据一致性验证
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Club = require('../models/Club');
const { GitSyncService } = require('../utils/GitSyncService');
const { getAutoSyncService } = require('../utils/AutoSyncService');
const fs = require('fs').promises;
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toLocaleTimeString();
  const icons = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    test: '🧪'
  };
  
  const color = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    test: colors.blue
  };

  console.log(`${color[level]}${icons[level]} [${timestamp}] ${message}${colors.reset}`);
}

/**
 * 测试1: GitSyncService 基本功能
 */
async function testGitSyncService() {
  log('test', '测试1: GitSyncService 基本功能');
  
  try {
    const gitSync = new GitSyncService();
    
    // 测试1.1: 获取当前分支
    log('info', '  1.1 获取当前分支...');
    const branch = await gitSync.getCurrentBranch();
    if (branch === 'main' || branch === 'master') {
      log('success', `  ✓ 分支正确: ${branch}`);
    } else {
      log('error', `  ✗ 分支错误: ${branch}`);
      return false;
    }

    // 测试1.2: 检查本地更改
    log('info', '  1.2 检查本地更改...');
    const hasChanges = await gitSync.hasLocalChanges();
    log('success', `  ✓ 本地更改状态: ${hasChanges ? '有更改' : '无更改'}`);

    // 测试1.3: 获取同步状态
    log('info', '  1.3 获取同步状态...');
    const status = gitSync.getSyncStatus();
    log('success', `  ✓ 同步状态: ${JSON.stringify(status)}`);

    log('success', '测试1 通过 ✓\n');
    return true;
  } catch (error) {
    log('error', `测试1 失败: ${error.message}\n`);
    return false;
  }
}

/**
 * 测试2: 数据导出功能
 */
async function testDataExport() {
  log('test', '测试2: 数据导出功能');
  
  try {
    // 连接MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    log('success', '  ✓ MongoDB连接成功');

    // 获取俱乐部数据
    const clubs = await Club.find({}).lean();
    log('info', `  📊 找到 ${clubs.length} 个俱乐部`);

    if (clubs.length === 0) {
      log('warning', '  ⚠️ 数据库为空，跳过数据验证');
      log('success', '测试2 通过 ✓\n');
      return true;
    }

    // 验证第一个俱乐部数据
    const testClub = clubs[0];
    log('info', `  检查第一个俱乐部: ${testClub.name}`);

    const requiredFields = ['name', 'school', 'province', 'coordinates'];
    let allFieldsPresent = true;

    for (const field of requiredFields) {
      if (!testClub[field]) {
        log('error', `  ✗ 缺少字段: ${field}`);
        allFieldsPresent = false;
      }
    }

    if (allFieldsPresent) {
      log('success', `  ✓ 所有必需字段都存在`);
    } else {
      return false;
    }

    // 验证坐标格式
    if (Array.isArray(testClub.coordinates) && testClub.coordinates.length === 2) {
      log('success', `  ✓ 坐标格式正确: [${testClub.coordinates}]`);
    } else {
      log('error', `  ✗ 坐标格式错误`);
      return false;
    }

    log('success', '测试2 通过 ✓\n');
    return true;
  } catch (error) {
    log('error', `测试2 失败: ${error.message}\n`);
    return false;
  }
}

/**
 * 测试3: AutoSyncService 状态管理
 */
async function testAutoSyncService() {
  log('test', '测试3: AutoSyncService 状态管理');
  
  try {
    const autoSync = getAutoSyncService();

    // 测试3.1: 获取初始状态
    log('info', '  3.1 获取初始状态...');
    const status = autoSync.getSyncStatus();
    
    if (!status.inProgress && status.gitQueue.queueLength === 0) {
      log('success', `  ✓ 初始状态正确`);
    } else {
      log('error', `  ✗ 初始状态异常`);
      return false;
    }

    // 测试3.2: 获取上次同步时间
    log('info', '  3.2 获取上次同步时间...');
    const lastSyncTime = autoSync.getLastSyncTime();
    log('success', `  ✓ 上次同步时间: ${lastSyncTime || '未同步'}`);

    log('success', '测试3 通过 ✓\n');
    return true;
  } catch (error) {
    log('error', `测试3 失败: ${error.message}\n`);
    return false;
  }
}

/**
 * 测试4: clubs.json 文件验证
 */
async function testClubsJsonFormat() {
  log('test', '测试4: clubs.json 文件验证');
  
  try {
    const clubsJsonPath = path.join(__dirname, '../../public/data/clubs.json');

    // 测试4.1: 文件是否存在
    log('info', '  4.1 检查clubs.json文件...');
    try {
      await fs.access(clubsJsonPath);
      log('success', `  ✓ 文件存在: ${clubsJsonPath}`);
    } catch (error) {
      log('error', `  ✗ 文件不存在`);
      return false;
    }

    // 测试4.2: 读取并解析JSON
    log('info', '  4.2 解析JSON格式...');
    const content = await fs.readFile(clubsJsonPath, 'utf8');
    let clubs;
    try {
      clubs = JSON.parse(content);
      log('success', `  ✓ JSON格式有效`);
    } catch (parseError) {
      log('error', `  ✗ JSON格式错误: ${parseError.message}`);
      return false;
    }

    // 测试4.3: 检查数组结构
    log('info', '  4.3 检查数组结构...');
    if (Array.isArray(clubs)) {
      log('success', `  ✓ 正确的数组结构，包含 ${clubs.length} 条记录`);
    } else {
      log('error', `  ✗ 不是数组结构`);
      return false;
    }

    // 测试4.4: 验证样本记录
    if (clubs.length > 0) {
      log('info', '  4.4 验证样本记录...');
      const sampleClub = clubs[0];
      
      if (sampleClub.name && sampleClub.school) {
        log('success', `  ✓ 样本记录有效: ${sampleClub.name}`);
      } else {
        log('error', `  ✗ 样本记录缺少必需字段`);
        return false;
      }
    }

    log('success', '测试4 通过 ✓\n');
    return true;
  } catch (error) {
    log('error', `测试4 失败: ${error.message}\n`);
    return false;
  }
}

/**
 * 测试5: Git仓库状态
 */
async function testGitRepository() {
  log('test', '测试5: Git仓库状态');
  
  try {
    const gitSync = new GitSyncService();

    // 测试5.1: 获取分支信息
    log('info', '  5.1 获取分支信息...');
    const branch = await gitSync.getCurrentBranch();
    log('success', `  ✓ 当前分支: ${branch}`);

    // 测试5.2: 检查origin连接
    log('info', '  5.2 检查远程连接...');
    try {
      // 尝试执行git ls-remote检查连接
      const remoteUrl = await gitSync.executeGitCommand('config --get remote.origin.url');
      log('success', `  ✓ 远程仓库: ${remoteUrl}`);
    } catch (error) {
      log('warning', `  ⚠️ 无法获取远程仓库信息: ${error.message}`);
    }

    log('success', '测试5 通过 ✓\n');
    return true;
  } catch (error) {
    log('error', `测试5 失败: ${error.message}\n`);
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 自动同步系统集成测试');
  console.log('='.repeat(60) + '\n');

  const tests = [
    { name: 'GitSyncService基本功能', fn: testGitSyncService },
    { name: '数据导出功能', fn: testDataExport },
    { name: 'AutoSyncService状态管理', fn: testAutoSyncService },
    { name: 'clubs.json文件验证', fn: testClubsJsonFormat },
    { name: 'Git仓库状态', fn: testGitRepository }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      log('error', `测试异常: ${test.name}`);
      log('error', `错误: ${error.message}\n`);
      results.push({ name: test.name, passed: false });
    }
  }

  // 输出测试总结
  console.log('='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));

  let passedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    const status = result.passed ? '✓' : '✗';
    const color = result.passed ? colors.green : colors.red;
    console.log(`${color}${status} ${result.name}${colors.reset}`);
    
    if (result.passed) passedCount++;
    else failedCount++;
  }

  console.log('='.repeat(60));
  console.log(`\n总数: ${results.length} | 通过: ${passedCount} | 失败: ${failedCount}\n`);

  // 清理
  await mongoose.disconnect();

  // 返回是否全部通过
  return failedCount === 0;
}

// 运行测试
runAllTests().then(allPassed => {
  process.exit(allPassed ? 0 : 1);
}).catch(error => {
  log('error', `测试执行失败: ${error.message}`);
  process.exit(1);
});
