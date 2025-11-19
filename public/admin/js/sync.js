import { checkAuth, logout, authFetch } from './auth.js';

// Check authentication on page load and initialize accordingly
async function initializePage() {
  try {
    const isAuthenticated = await checkAuth();

    if (isAuthenticated) {
      // 用户已认证，初始化同步功能
      initSyncModule();
    } else {
      // 用户未认证，显示登录提示或等待状态
      console.log('User not authenticated, sync module not initialized');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

initializePage();

// 当在 admin index 中时初始化同步功能
function initSyncModule() {
  console.log('🔄 Initializing Sync Module...');

  // 检查是否有服务不可用消息，如果有则不初始化
  const serviceMessage = document.getElementById('service-unavailable-message');
  if (serviceMessage) {
    console.log('⏳ Service unavailable, skipping sync module initialization');
    return;
  }

  // 检查必要的 DOM 元素
  const compareBtn = document.getElementById('compareBtn');
  const migrateJsonToDbBtn = document.getElementById('migrateJsonToDbBtn');
  const migrateDbToJsonBtn = document.getElementById('migrateDbToJsonBtn');
  const mergeBtn = document.getElementById('mergeBtn');
  const gitPullBtn = document.getElementById('gitPullBtn');
  const gitPushBtn = document.getElementById('gitPushBtn');
  const replaceBtn = document.getElementById('replaceBtn');
  
  if (!compareBtn || !migrateJsonToDbBtn || !mergeBtn || !replaceBtn || !gitPullBtn || !gitPushBtn) {
    console.warn('⚠️  Sync buttons not found in DOM:', {
      compareBtn: !!compareBtn,
      migrateJsonToDbBtn: !!migrateJsonToDbBtn,
      migrateDbToJsonBtn: !!migrateDbToJsonBtn,
      mergeBtn: !!mergeBtn,
      gitPullBtn: !!gitPullBtn,
      gitPushBtn: !!gitPushBtn,
      replaceBtn: !!replaceBtn
    });
    return;
  }

  const messageContainer = document.getElementById('messageContainer');
  const statsContainer = document.getElementById('statsContainer');
  const comparisonContainer = document.getElementById('comparisonContainer');
  
  if (!messageContainer || !statsContainer || !comparisonContainer) {
    console.warn('⚠️  Required containers not found:', {
      messageContainer: !!messageContainer,
      statsContainer: !!statsContainer,
      comparisonContainer: !!comparisonContainer
    });
    return;
  }
  
  console.log('✅ All required DOM elements found');

  // Compare data
  compareBtn.addEventListener('click', async () => {
    try {
      compareBtn.disabled = true;
      compareBtn.textContent = '对比中...';
      clearMessage();

      const response = await authFetch('/api/sync/compare');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '对比失败');
      }

      displayComparisonResults(result.data);
      showMessage('数据对比完成', 'success');

    } catch (error) {
      console.error('Compare error:', error);
      if (error.message === 'SERVICE_UNAVAILABLE') {
        showMessage('数据库连接暂时不可用，请稍后再试', 'warning');
      } else {
        showMessage(error.message || '对比失败，请重试', 'error');
      }
    } finally {
      compareBtn.disabled = false;
      compareBtn.textContent = '对比数据';
    }
  });

  // Migrate/overwrite: JSON to Database
  migrateJsonToDbBtn.addEventListener('click', async () => {
    if (!confirm('确定要用 JSON 文件覆盖 Database 吗？\n\n此操作将：\n- 删除 Database 中的所有现有数据\n- 导入 JSON 文件中的所有社团\n- 可能导致 Database 独有的记录被删除')) {
      return;
    }

    try {
      migrateJsonToDbBtn.disabled = true;
      migrateJsonToDbBtn.textContent = '覆盖中...';
      clearMessage();

      const response = await authFetch('/api/sync/replace', {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '覆盖失败');
      }

      showMessage(
        `✅ 用 JSON 覆盖 Database 完成！\n\n总计: ${result.data.total} 个社团`,
        'success'
      );

      // Refresh comparison
      compareBtn.click();

    } catch (error) {
      console.error('Overwrite DB error:', error);
      if (error.message === 'SERVICE_UNAVAILABLE') {
        showMessage('数据库连接暂时不可用，请稍后再试', 'warning');
      } else {
        showMessage(error.message || '覆盖失败，请重试', 'error');
      }
    } finally {
      migrateJsonToDbBtn.disabled = false;
      migrateJsonToDbBtn.textContent = '用 JSON 覆盖 Database';
    }
  });

  // Migrate/overwrite: Database to JSON
  if (migrateDbToJsonBtn) {
    migrateDbToJsonBtn.addEventListener('click', async () => {
      if (!confirm('确定要用 Database 覆盖 JSON 文件吗？\n\n此操作将：\n- 使用 Database 中的所有数据覆盖 JSON 文件\n- JSON 文件中独有的记录将被删除\n- 所有社团按 index 排序')) {
        return;
      }

      try {
        migrateDbToJsonBtn.disabled = true;
        migrateDbToJsonBtn.textContent = '覆盖中...';
        clearMessage();

        const response = await authFetch('/api/sync/overwrite-json', {
          method: 'POST'
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || '覆盖失败');
        }

        showMessage(
          `✅ 用 Database 覆盖 JSON 完成！\n\n总计: ${result.data.total} 个社团`,
          'success'
        );

        // Refresh comparison
        compareBtn.click();

      } catch (error) {
        console.error('Overwrite JSON error:', error);
        if (error.message === 'SERVICE_UNAVAILABLE') {
          showMessage('数据库连接暂时不可用，请稍后再试', 'warning');
        } else {
          showMessage(error.message || '覆盖失败，请重试', 'error');
        }
      } finally {
        migrateDbToJsonBtn.disabled = false;
        migrateDbToJsonBtn.textContent = '用 Database 覆盖 JSON';
      }
    });
  }

  // Merge data
  mergeBtn.addEventListener('click', async () => {
    if (!confirm('确定要执行双向智能合并吗？\n\n此操作将：\n- 将 JSON 中的数据合并到 MongoDB\n- 将 MongoDB 中的数据更新到 JSON\n- 保留两方独有的记录')) {
      return;
    }

    try {
      mergeBtn.disabled = true;
      mergeBtn.textContent = '合并中...';
      clearMessage();

      const response = await authFetch('/api/sync/merge', {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '合并失败');
      }

      const data = result.data;
      showMessage(
        `双向智能合并完成！\n\n MongoDB 数据库:\n  - 新增: ${data.database.added}\n  - 更新: ${data.database.updated}\n\nJSON 文件:\n  - 新增: ${data.json.added}\n  - 未变: ${data.json.unchanged}`,
        'success'
      );

      // Refresh comparison
      compareBtn.click();

    } catch (error) {
      console.error('Merge error:', error);
      if (error.message === 'SERVICE_UNAVAILABLE') {
        showMessage('数据库连接暂时不可用，请稍后再试', 'warning');
      } else {
        showMessage(error.message || '合并失败，请重试', 'error');
      }
    } finally {
      mergeBtn.disabled = false;
      mergeBtn.textContent = '双向合并';
    }
  });

  // Replace data
  replaceBtn.addEventListener('click', async () => {
    if (!confirm('⚠️ 警告：单向完全替换模式\n\n此操作将用 MongoDB 数据完全覆盖 JSON 文件！\nJSON 中独有的记录将被删除。\n\n确定要继续吗？')) {
      return;
    }

    try {
      replaceBtn.disabled = true;
      replaceBtn.textContent = '替换中...';
      clearMessage();

      const response = await authFetch('/api/sync/replace', {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '替换失败');
      }

      showMessage(
        `单向完全替换完成（MongoDB -> JSON）！\n总计: ${result.data.total} 个社团`,
        'success'
      );

      // Refresh comparison
      compareBtn.click();

    } catch (error) {
      console.error('Replace error:', error);
      if (error.message === 'SERVICE_UNAVAILABLE') {
        showMessage('数据库连接暂时不可用，请稍后再试', 'warning');
      } else {
        showMessage(error.message || '替换失败，请重试', 'error');
      }
    } finally {
      replaceBtn.disabled = false;
      replaceBtn.textContent = '单向替换';
    }
  });

  // Git Pull
  gitPullBtn.addEventListener('click', async () => {
    if (!confirm('确定要执行 Git Pull 吗？\n\n这将从远程仓库拉取最新代码并合并到本地分支。')) {
      return;
    }

    try {
      gitPullBtn.disabled = true;
      gitPullBtn.textContent = 'Pull 中...';
      clearMessage();

      const response = await authFetch('/api/sync/git-pull', {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Git Pull 失败');
      }

      showMessage(
        `Git Pull 完成！\n${result.data.message || ''}`,
        'success'
      );

    } catch (error) {
      console.error('Git pull error:', error);
      showMessage(error.message || 'Git Pull 失败，请重试', 'error');
    } finally {
      gitPullBtn.disabled = false;
      gitPullBtn.textContent = 'Git Pull';
    }
  });

  // Git Push (add -> commit -> push)
  gitPushBtn.addEventListener('click', async () => {
    if (!confirm('确定要执行 Git 提交吗？\n\n这将自动执行以下操作：\n1. 添加所有更改（git add .）\n2. 提交更改（git commit）\n3. 推送到远程仓库（git push）\n\n如果遭遇冲突，将停止并显示错误。')) {
      return;
    }

    try {
      gitPushBtn.disabled = true;
      gitPushBtn.textContent = '提交中...';
      clearMessage();

      const response = await authFetch('/api/sync/git-push', {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Git 提交失败');
      }

      showMessage(
        `Git 提交完成！\n${result.data.message || ''}`,
        'success'
      );

    } catch (error) {
      console.error('Git push error:', error);
      showMessage(error.message || 'Git 提交失败，请检查冲突后重试', 'error');
    } finally {
      gitPushBtn.disabled = false;
      gitPushBtn.textContent = 'Git 提交';
    }
  });

  // Display comparison results
  function displayComparisonResults(data) {
    const { stats, details } = data;

    // Update stats
    document.getElementById('dbCount').textContent = stats.database.total;
    document.getElementById('jsonCount').textContent = stats.json.total;
    document.getElementById('duplicateCount').textContent = stats.comparison.identical;
    document.getElementById('differenceCount').textContent = stats.comparison.different;

    statsContainer.classList.remove('hidden');
    comparisonContainer.classList.remove('hidden');

    // Render comparison tabs
    renderComparisonTabs(details);
  }

  function renderComparisonTabs(details) {
    const container = document.getElementById('comparisonContent');
    
    // 创建标签页内容
    const tabsData = {
      'only-db': {
        title: '仅在数据库中的社团',
        items: details.dbOnly,
        template: (club, index) => `
          <div class="club-item">
            <div class="club-header">
              <div>
                <div class="club-name">${escapeHtml(club.name)}</div>
                <div class="club-school">${escapeHtml(club.school)}</div>
              </div>
              <span class="badge info">仅在数据库</span>
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
              <button class="atomic-merge-single-btn" data-action="db-to-json" data-identifier="${escapeHtml(club.name)}|${escapeHtml(club.school)}" style="width: 100%; padding: 0.5rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                📥 导入到 JSON
              </button>
            </div>
          </div>
        `
      },
      'only-json': {
        title: '仅在 JSON 文件中的社团',
        items: details.jsonOnly,
        template: (club, index) => `
          <div class="club-item">
            <div class="club-header">
              <div>
                <div class="club-name">${escapeHtml(club.name)}</div>
                <div class="club-school">${escapeHtml(club.school)}</div>
              </div>
              <span class="badge danger">⚠️ 仅在 JSON</span>
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
              <button class="atomic-merge-single-btn" data-action="json-to-db" data-identifier="${escapeHtml(club.name)}|${escapeHtml(club.school)}" style="width: 100%; padding: 0.5rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                📤 导入到 Database
              </button>
            </div>
          </div>
        `
      },
      'differences': {
        title: '有差异的记录',
        items: details.different,
        template: (item, index) => `
          <div class="diff-item">
            <div class="club-header">
              <div>
                <div class="club-name">${escapeHtml(item.db.name)}</div>
                <div class="club-school">${escapeHtml(item.db.school)}</div>
              </div>
              <span class="badge warning">${item.differences.length} 个差异</span>
            </div>
            ${item.differences.map(diff => `
              <div style="margin-top: 1rem;">
                <div class="diff-field">字段: ${diff.field}</div>
                <div class="diff-values">
                  <div>
                    <div class="diff-label">数据库值</div>
                    <div class="diff-value db">${formatValue(diff.database)}</div>
                  </div>
                  <div>
                    <div class="diff-label">JSON 值</div>
                    <div class="diff-value json">${formatValue(diff.json)}</div>
                  </div>
                </div>
              </div>
            `).join('')}
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
              <div style="font-size: 0.9rem; margin-bottom: 0.75rem; color: #666;">原子化合并：</div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="atomic-merge-btn" data-action="db-to-json" data-index="${index}" style="flex: 1; padding: 0.5rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                  📥 Database → JSON
                </button>
                <button class="atomic-merge-btn" data-action="json-to-db" data-index="${index}" style="flex: 1; padding: 0.5rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                  📤 JSON → Database
                </button>
              </div>
            </div>
          </div>
        `
      },
      'duplicates': {
        title: '重复记录',
        items: details.duplicates || [],
        template: (item) => `
          <div class="diff-item">
            <div class="club-header">
              <div>
                <div class="club-name">🔄 重复检测</div>
                <div class="club-school">判断依据: ${escapeHtml(item.criteria)}</div>
              </div>
              <span class="badge warning">${item.records.length} 条重复</span>
            </div>
            <div style="margin-top: 1rem;">
              <div class="diff-label">重复记录列表（根据 name + school）：</div>
              ${item.records.map((record, idx) => `
                <div class="club-item" style="margin-top: 0.5rem; padding: 0.75rem; background: ${idx % 2 === 0 ? '#f9f9f9' : '#fff'}; border-left: 3px solid ${record.source === 'database' ? '#3b82f6' : '#f59e0b'};">
                  <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                      <div class="club-name" style="font-size: 0.9rem;">${escapeHtml(record.name)}</div>
                      <div class="club-school" style="font-size: 0.85rem;">${escapeHtml(record.school)}</div>
                      <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">
                        标识: ${escapeHtml(record.name)}|${escapeHtml(record.school)}
                      </div>
                    </div>
                    <span class="badge ${record.source === 'database' ? 'info' : 'warning'}" style="font-size: 0.75rem;">
                      ${record.source === 'database' ? '数据库' : 'JSON'}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `
      }
    };

    // 绑定标签页点击事件
    document.querySelectorAll('.comp-tab-btn').forEach(btn => {
      btn.removeEventListener('click', handleTabClick);
      btn.addEventListener('click', handleTabClick);
    });

    function handleTabClick(e) {
      const tabName = e.target.getAttribute('data-tab');
      
      // 更新按钮状态
      document.querySelectorAll('.comp-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // 更新内容
      const tabData = tabsData[tabName];
      if (!tabData) return;

      if (tabData.items.length === 0) {
        container.innerHTML = `<p class="loading">没有 ${tabData.title}</p>`;
      } else {
        container.innerHTML = tabData.items.map((item, index) => tabData.template(item, index)).join('');
        
        // 为原子化合并按钮绑定事件
        if (tabName === 'differences') {
          document.querySelectorAll('.atomic-merge-btn').forEach(btn => {
            btn.addEventListener('click', handleAtomicMerge);
          });
        } else if (tabName === 'only-db' || tabName === 'only-json') {
          document.querySelectorAll('.atomic-merge-single-btn').forEach(btn => {
            btn.addEventListener('click', handleAtomicMergeSingle);
          });
        }
      }
    }

    // 有差异记录原子化合并处理函数
    async function handleAtomicMerge(e) {
      const action = e.target.getAttribute('data-action');
      const index = parseInt(e.target.getAttribute('data-index'));
      const item = tabsData['differences'].items[index];
      
      if (!item) return;

      const identifier = `${item.db.name}|${item.db.school}`;
      
      const confirmMsg = action === 'db-to-json' 
        ? `确定要将 Database 中的 "${item.db.name}" 覆盖 JSON 中的记录吗？`
        : `确定要将 JSON 中的 "${item.db.name}" 覆盖 Database 中的记录吗？`;

      if (!confirm(confirmMsg)) {
        return;
      }

      const originalText = e.target.textContent;

      try {
        e.target.disabled = true;
        e.target.textContent = '处理中...';
        clearMessage();

        const endpoint = action === 'db-to-json' 
          ? '/api/sync/atomic-merge-db-to-json'
          : '/api/sync/atomic-merge-json-to-db';

        const response = await authFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || '合并失败');
        }

        showMessage(
          `原子化合并成功！\n\n社团: ${item.db.name}\n方向: ${action === 'db-to-json' ? 'Database → JSON' : 'JSON → Database'}`,
          'success'
        );

        // 自动刷新对比结果
        setTimeout(() => compareBtn.click(), 1000);

      } catch (error) {
        console.error('Atomic merge error:', error);
        showMessage(error.message || '原子化合并失败，请重试', 'error');
      } finally {
        e.target.disabled = false;
        e.target.textContent = originalText;
      }
    }

    // 单条记录原子化合并处理函数
    async function handleAtomicMergeSingle(e) {
      const action = e.target.getAttribute('data-action');
      const identifier = e.target.getAttribute('data-identifier');
      
      const confirmMsg = action === 'db-to-json' 
        ? `确定要将 Database 中的 "${identifier}" 导入到 JSON 吗？`
        : `确定要将 JSON 中的 "${identifier}" 导入到 Database 吗？`;

      if (!confirm(confirmMsg)) {
        return;
      }

      const originalText = e.target.textContent;

      try {
        e.target.disabled = true;
        e.target.textContent = '处理中...';
        clearMessage();

        const endpoint = action === 'db-to-json' 
          ? '/api/sync/atomic-merge-db-to-json'
          : '/api/sync/atomic-merge-json-to-db';

        const response = await authFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || '合并失败');
        }

        showMessage(
          `✅ 原子化合并成功！\n\n社团: ${identifier}\n方向: ${action === 'db-to-json' ? 'Database → JSON' : 'JSON → Database'}`,
          'success'
        );

        // 自动刷新对比结果
        setTimeout(() => compareBtn.click(), 1000);

      } catch (error) {
        console.error('Atomic merge single error:', error);
        showMessage(error.message || '原子化合并失败，请重试', 'error');
      } finally {
        e.target.disabled = false;
        e.target.textContent = originalText;
      }
    }

    // 显示第一个标签页
    const firstTab = document.querySelector('.comp-tab-btn');
    if (firstTab) {
      firstTab.click();
    }
  }

  // Utility functions
  function showMessage(message, type = 'info') {
    const className = type === 'error' ? 'error-message' : 'success-message';
    messageContainer.innerHTML = `<div class="${className}">${escapeHtml(message).replace(/\n/g, '<br>')}</div>`;
  }

  function clearMessage() {
    messageContainer.innerHTML = '';
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function formatValue(value) {
    if (value === null || value === undefined) {
      return '<em>空</em>';
    }
    if (typeof value === 'object') {
      return escapeHtml(JSON.stringify(value, null, 2));
    }
    return escapeHtml(String(value));
  }
}

// 初始化同步模块
// 确保 DOM 完全加载后再初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM fully loaded, initializing Sync Module');
    initSyncModule();
  });
} else {
  console.log('📄 DOM already loaded, initializing Sync Module');
  initSyncModule();
}
