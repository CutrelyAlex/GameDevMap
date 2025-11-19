import { authFetch } from './auth.js';

let clubsTableBody;
let clubSearchInput;
let refreshClubsButton;
let clubsListStatus;
let clubEditModal;
let clubEditForm;

let clubsData = [];
let filteredClubs = [];

/**
 * 初始化元素引用
 */
function initElements() {
  if (!clubsTableBody) {
    clubsTableBody = document.getElementById('clubsTableBody');
    clubSearchInput = document.getElementById('clubSearchInput');
    refreshClubsButton = document.getElementById('refreshClubsButton');
    clubsListStatus = document.getElementById('clubsListStatus');
    clubEditModal = document.getElementById('clubEditModal');
    clubEditForm = document.getElementById('clubEditForm');

    // 绑定模态框关闭事件
    if (clubEditModal) {
      clubEditModal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
          clubEditModal.classList.add('hidden');
        });
      });
    }

    // 绑定表单提交事件
    if (clubEditForm) {
      clubEditForm.addEventListener('submit', handleEditSubmit);
    }
  }
}

/**
 * 设置状态消息
 */
function setClubsListStatus(message, type) {
  if (!clubsListStatus) return;
  clubsListStatus.textContent = message || '';
  clubsListStatus.classList.remove('is-error', 'is-success');
  if (!message) {
    return;
  }
  clubsListStatus.classList.add(type === 'success' ? 'is-success' : 'is-error');
}

/**
 * 加载所有社团
 */
async function loadClubs() {
  try {
    setClubsListStatus('加载中...', '');
    
    const response = await authFetch('/api/clubs');
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    clubsData = result.data || [];
    filteredClubs = [...clubsData];
    
    renderClubsTable();
    setClubsListStatus(`共 ${clubsData.length} 个社团`, 'success');
    
    setTimeout(() => setClubsListStatus('', ''), 3000);
  } catch (error) {
    console.error('Load clubs failed:', error);
    setClubsListStatus(`加载失败: ${error.message}`, 'error');
    clubsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">加载失败，请重试</td></tr>';
  }
}

/**
 * 渲染社团列表
 */
function renderClubsTable() {
  if (!clubsTableBody) {
    console.error('clubsTableBody 元素未找到');
    return;
  }
  
  if (filteredClubs.length === 0) {
    clubsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">暂无社团数据</td></tr>';
    return;
  }

  clubsTableBody.innerHTML = '';

  filteredClubs.forEach(club => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${club.index !== undefined ? club.index : '-'}</td>
      <td>${escapeHTML(club.name)}</td>
      <td>${escapeHTML(club.school)}</td>
      <td>${escapeHTML(club.province)}</td>
      <td>${escapeHTML(club.city || '-')}</td>
      <td>${formatDate(club.createdAt || '')}</td>
      <td>
        <button class="action-button" data-club-id="${club.id}" data-action="edit">
          编辑
        </button>
        <button class="action-button action-button--danger" data-club-id="${club.id}" data-action="delete">
          删除
        </button>
      </td>
    `;

    clubsTableBody.appendChild(row);
  });

  // 绑定按钮事件
  clubsTableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', handleDeleteClub);
  });
  
  clubsTableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', handleEditClub);
  });
}

/**
 * 打开编辑模态框
 */
function handleEditClub(e) {
  const clubId = e.target.dataset.clubId;
  const club = clubsData.find(c => c.id === clubId);
  
  if (!club) return;

  document.getElementById('editClubId').value = club.id;
  document.getElementById('editClubIndex').value = club.index || 0;
  document.getElementById('editClubName').value = club.name;
  document.getElementById('editClubSchool').value = club.school;
  document.getElementById('editClubProvince').value = club.province;
  document.getElementById('editClubCity').value = club.city || '';
  document.getElementById('editClubLogo').value = club.logo || '';

  const preview = document.getElementById('editClubLogoPreview');
  if (club.logo) {
    preview.innerHTML = `<img src="${club.logo}" alt="Logo Preview" style="max-width: 100%; height: auto;">`;
  } else {
    preview.innerHTML = '';
  }

  clubEditModal.classList.remove('hidden');
}

/**
 * 处理编辑提交
 */
async function handleEditSubmit(e) {
  e.preventDefault();
  
  const clubId = document.getElementById('editClubId').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  const formData = {
    index: parseInt(document.getElementById('editClubIndex').value) || 0,
    name: document.getElementById('editClubName').value,
    school: document.getElementById('editClubSchool').value,
    province: document.getElementById('editClubProvince').value,
    city: document.getElementById('editClubCity').value,
    logo: document.getElementById('editClubLogo').value
  };

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';

    const response = await authFetch(`/api/clubs/${clubId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result?.message || '更新失败');
    }

    setClubsListStatus(`社团 "${formData.name}" 更新成功`, 'success');
    clubEditModal.classList.add('hidden');
    
    // 重新加载列表
    loadClubs();

  } catch (error) {
    console.error('Update club failed:', error);
    alert(`更新失败: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * 删除社团
 */
async function handleDeleteClub(e) {
  const clubId = e.target.dataset.clubId;
  const clubRow = e.target.closest('tr');
  const clubName = clubRow.querySelector('td:first-child').textContent;
  const clubSchool = clubRow.querySelector('td:nth-child(2)').textContent;

  const confirmed = confirm(`确定要删除社团 "${clubName}" (${clubSchool}) 吗？\n\n此操作不可恢复，将同时更新数据库和 clubs.json 文件。`);
  
  if (!confirmed) {
    return;
  }

  try {
    e.target.disabled = true;
    e.target.textContent = '删除中...';

    const response = await authFetch(`/api/clubs/${clubId}`, {
      method: 'DELETE'
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    setClubsListStatus(`已删除: ${clubName}`, 'success');
    
    // 从本地数据中移除
    clubsData = clubsData.filter(c => c.id !== clubId);
    filteredClubs = filteredClubs.filter(c => c.id !== clubId);
    
    // 重新渲染
    renderClubsTable();
    
    setTimeout(() => setClubsListStatus('', ''), 3000);
  } catch (error) {
    console.error('Delete club failed:', error);
    setClubsListStatus(`删除失败: ${error.message}`, 'error');
    e.target.disabled = false;
    e.target.textContent = '删除';
  }
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return '-';
  }
}

/**
 * HTML 转义
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 初始化
 */
export function initClubsManagement() {
  // 初始化元素引用
  initElements();
  
  if (!clubsTableBody || !clubSearchInput || !refreshClubsButton || !clubsListStatus) {
    console.error('社团管理元素未找到');
    return;
  }

  // 绑定事件
  refreshClubsButton.addEventListener('click', loadClubs);
  
  clubSearchInput.addEventListener('input', () => {
    filterClubs();
  });

  // 初始加载
  loadClubs();
}
