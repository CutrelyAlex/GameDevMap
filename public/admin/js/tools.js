import { checkAuth, logout, authFetch } from './auth.js';

// 操作日志数组
let operationLogs = [];

// 初始化页面
async function initializePage() {
  try {
    const isAuthenticated = await checkAuth();

    if (isAuthenticated) {
      loadLogs();
      initTools();
    } else {
      console.log('User not authenticated');
      window.location.href = '/admin/';
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

// 加载日志
function loadLogs() {
  const stored = localStorage.getItem('toolsLogs');
  if (stored) {
    try {
      operationLogs = JSON.parse(stored);
      renderLogs();
    } catch (e) {
      operationLogs = [];
    }
  }
}

// 添加日志
function addLog(action, details, success = true) {
  const timestamp = new Date().toLocaleString('zh-CN');
  operationLogs.unshift({
    timestamp,
    action,
    details,
    success,
    id: Date.now()
  });
  
  // 只保留最近50条
  if (operationLogs.length > 50) {
    operationLogs = operationLogs.slice(0, 50);
  }
  
  localStorage.setItem('toolsLogs', JSON.stringify(operationLogs));
  renderLogs();
}

// 渲染日志
function renderLogs() {
  const container = document.getElementById('logContainer');
  if (!container) return;

  if (operationLogs.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999;">暂无操作记录</p>';
    return;
  }

  container.innerHTML = operationLogs.map(log => `
    <div class="log-entry ${log.success ? 'success' : 'error'}">
      <div class="log-entry-time">${escapeHtml(log.timestamp)}</div>
      <div class="log-entry-action">${log.success ? '✓' : '✗'} ${escapeHtml(log.action)}</div>
      <div class="log-entry-details">${escapeHtml(log.details)}</div>
    </div>
  `).join('');
}

// 初始化工具
function initTools() {
  console.log('🔧 Initializing Tools...');

  // JSON to DB
  const jsonToDBBtn = document.getElementById('jsonToDBBtn');
  if (jsonToDBBtn) {
    jsonToDBBtn.addEventListener('click', handleJsonToDB);
  }

  // Migrate Clubs
  const migrateClubsBtn = document.getElementById('migrateClubsBtn');
  if (migrateClubsBtn) {
    migrateClubsBtn.addEventListener('click', handleMigrateClubs);
  }

  // Cleanup Logos
  const cleanupLogosBtn = document.getElementById('cleanupLogosBtn');
  if (cleanupLogosBtn) {
    cleanupLogosBtn.addEventListener('click', handleCleanupLogos);
  }

  // Git Quick
  const gitQuickBtn = document.getElementById('gitQuickBtn');
  if (gitQuickBtn) {
    gitQuickBtn.addEventListener('click', handleGitQuick);
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  console.log('✅ Tools initialized');
}

// JSON → DB
async function handleJsonToDB() {
  if (!confirm('⚠️ 警告：JSON → DB 导入\n\n此操作将：\n- 从 JSON 文件读取社团数据\n- 导入到 MongoDB 数据库\n- 不会删除现有数据\n\n确定要继续吗？')) {
    return;
  }

  const btn = document.getElementById('jsonToDBBtn');
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="tool-btn-title">导入中...</span>';
    clearMessage();

    const response = await authFetch('/api/tools/jsonToDB', {
      method: 'POST'
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'JSON→DB 导入失败');
    }

    const msg = `成功导入 ${result.data.total} 个社团`;
    addLog('JSON→DB导入', msg, true);
    showMessage(msg, 'success');

  } catch (error) {
    console.error('JSON to DB error:', error);
    addLog('JSON→DB导入', error.message, false);
    showMessage(error.message || 'JSON→DB 导入失败', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="tool-btn-title">JSON → 数据库</span><span class="tool-btn-desc">将 JSON 文件数据导入到 MongoDB</span>';
  }
}

// 迁移社团数据
async function handleMigrateClubs() {
  if (!confirm('⚠️ 确定要执行数据库迁移吗？\n\n此操作将运行完整的数据迁移脚本。')) {
    return;
  }

  const btn = document.getElementById('migrateClubsBtn');
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="tool-btn-title">迁移中...</span>';
    clearMessage();

    const response = await authFetch('/api/tools/migrateClubs', {
      method: 'POST'
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '数据迁移失败');
    }

    const msg = `数据迁移完成：${result.data.message || '成功'}`;
    addLog('数据库迁移', msg, true);
    showMessage(msg, 'success');

  } catch (error) {
    console.error('Migrate error:', error);
    addLog('数据库迁移', error.message, false);
    showMessage(error.message || '数据迁移失败', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="tool-btn-title">迁移社团数据</span><span class="tool-btn-desc">执行完整的数据库迁移脚本</span>';
  }
}

// 清理孤立图片
async function handleCleanupLogos() {
  if (!confirm('⚠️ 确定要清理孤立的 Logo 图片吗？\n\n此操作将删除未被任何社团引用的 Logo 文件。')) {
    return;
  }

  const btn = document.getElementById('cleanupLogosBtn');
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="tool-btn-title">清理中...</span>';
    clearMessage();

    const response = await authFetch('/api/tools/cleanupLogos', {
      method: 'POST'
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '清理失败');
    }

    const msg = `清理完成，删除了 ${result.data.deletedCount || 0} 个孤立文件`;
    addLog('清理孤立图片', msg, true);
    showMessage(msg, 'success');

  } catch (error) {
    console.error('Cleanup error:', error);
    addLog('清理孤立图片', error.message, false);
    showMessage(error.message || '清理失败', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="tool-btn-title">清理孤立图片</span><span class="tool-btn-desc">删除未被引用的 Logo 文件</span>';
  }
}

// Git 快速提交
async function handleGitQuick() {
  const commitMsg = prompt('请输入 Git 提交信息：', '更新社团数据');
  if (!commitMsg) return;

  const btn = document.getElementById('gitQuickBtn');
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="tool-btn-title">Git 操作中...</span>';
    clearMessage();

    const response = await authFetch('/api/tools/gitQuick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: commitMsg })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Git 操作失败');
    }

    const msg = `Git 提交完成：${commitMsg}`;
    addLog('Git快速提交', msg, true);
    showMessage('✓ git add .\n✓ git commit\n✓ git pull\n✓ git push', 'success');

  } catch (error) {
    console.error('Git error:', error);
    addLog('Git快速提交', error.message, false);
    showMessage(error.message || 'Git 操作失败', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="tool-btn-title">快速提交 & 推送</span><span class="tool-btn-desc">执行 add → commit → pull → push</span>';
  }
}

// 工具函数
function showMessage(message, type = 'info') {
  const container = document.getElementById('messageContainer');
  if (!container) return;

  container.className = `message-box ${type} show`;
  container.innerHTML = escapeHtml(message).replace(/\n/g, '<br>');

  // 5秒后自动隐藏
  setTimeout(() => {
    container.className = 'message-box';
  }, 5000);
}

function clearMessage() {
  const container = document.getElementById('messageContainer');
  if (container) {
    container.className = 'message-box';
    container.innerHTML = '';
  }
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// 初始化
initializePage();
