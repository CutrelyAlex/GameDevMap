/**
 * AutoSync 配置文件
 * 管理自动化同步流程的配置参数
 */

const config = {
  // Git配置
  git: {
    // 最大重试次数
    maxRetries: 3,
    
    // 重试延迟（毫秒）
    retryDelay: 1000,
    
    // 冲突解决策略
    // 'ours' - 使用本地版本（clubs.json数据库最新）
    // 'theirs' - 使用远程版本（仓库中的版本）
    // 'reset' - 重置为远程版本后重做
    conflictResolutionStrategy: 'ours',
    
    // 操作超时时间（毫秒）
    commandTimeout: 30000
  },

  // 自动同步配置
  autoSync: {
    // 是否启用自动同步
    enabled: true,
    
    // 每次批准后是否自动同步
    syncOnApproval: true,
    
    // 每次拒绝后是否同步（更新rejected_clubs.json）
    syncOnRejection: false,
    
    // 并发同步数量限制（建议为1，避免冲突）
    maxConcurrentSyncs: 1,
    
    // 队列超时时间（毫秒）
    queueTimeout: 60000
  },

  // 迁移配置
  migration: {
    // 是否在Git push后自动运行迁移
    runAfterPush: true,
    
    // 迁移失败是否阻止流程
    blockOnFailure: false,
    
    // 迁移模式
    // 'full' - 完全删除后重新导入
    // 'upsert' - 更新或插入
    mode: 'full'
  },

  // 日志配置
  logging: {
    // 日志级别: 'debug', 'info', 'warn', 'error'
    level: 'info',
    
    // 是否记录详细的Git命令
    verboseGit: false,
    
    // 是否记录详细的文件操作
    verboseFile: false
  },

  // 数据验证配置
  validation: {
    // 是否验证clubs.json格式
    validateJsonFormat: true,
    
    // 是否验证必需字段
    validateRequiredFields: true,
    
    // 必需字段列表
    requiredFields: ['name', 'school', 'province', 'coordinates']
  },

  // 备份配置
  backup: {
    // 是否在同步前备份clubs.json
    enabled: true,
    
    // 备份保留数量
    keepCount: 5,
    
    // 备份目录
    directory: '/data/backups/clubs'
  },

  // 监控和通知配置
  monitoring: {
    // 是否启用监控
    enabled: true,
    
    // 失败重试次数阈值，超过则发送告警
    failureThreshold: 3,
    
    // 最后一次失败后多长时间内计为连续失败（毫秒）
    failureWindow: 3600000, // 1小时
    
    // 是否在同步完成后发送通知
    notifyOnCompletion: true,
    
    // 是否在同步失败后发送告警
    notifyOnFailure: true
  }
};

/**
 * 获取配置值
 * @param {string} path - 配置路径，使用点号分隔，如 'git.commandTimeout'
 * @param {*} defaultValue - 默认值
 * @returns {*} 配置值
 */
function getConfig(path, defaultValue = undefined) {
  const keys = path.split('.');
  let value = config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }

  return value;
}

/**
 * 设置配置值
 * @param {string} path - 配置路径
 * @param {*} value - 新值
 */
function setConfig(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let obj = config;

  for (const key of keys) {
    if (!(key in obj)) {
      obj[key] = {};
    }
    obj = obj[key];
  }

  obj[lastKey] = value;
}

/**
 * 验证配置
 */
function validateConfig() {
  const errors = [];

  // 验证Git配置
  if (config.git.maxRetries < 0) {
    errors.push('git.maxRetries must be non-negative');
  }

  // 验证自动同步配置
  if (config.autoSync.maxConcurrentSyncs < 1) {
    errors.push('autoSync.maxConcurrentSyncs must be at least 1');
  }

  // 验证冲突解决策略
  const validStrategies = ['ours', 'theirs', 'reset'];
  if (!validStrategies.includes(config.git.conflictResolutionStrategy)) {
    errors.push(`git.conflictResolutionStrategy must be one of: ${validStrategies.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取完整的配置对象
 */
function getFullConfig() {
  return JSON.parse(JSON.stringify(config));
}

module.exports = {
  config,
  getConfig,
  setConfig,
  validateConfig,
  getFullConfig
};
