import { login, verifyToken, clearSession, authFetch, getStoredUser } from './auth.js';
import { initClubsManagement } from './clubs.js';

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const adminDisplay = document.getElementById('adminDisplay');
const statusFilter = document.getElementById('statusFilter');
const sortSelect = document.getElementById('sortSelect');
const refreshButton = document.getElementById('refreshButton');
const listStatus = document.getElementById('listStatus');
const tableBody = document.getElementById('submissionTableBody');
const paginationEl = document.getElementById('pagination');
const detailModal = document.getElementById('detailModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalButton = document.getElementById('closeModalButton');
const detailBody = document.getElementById('detailBody');
const clubInfoList = document.getElementById('clubInfo');
const metaInfoList = document.getElementById('metaInfo');
const duplicateInfo = document.getElementById('duplicateInfo');
const modalFooter = document.getElementById('modalFooter');

// 标签页元素
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = {
  submissions: document.getElementById('submissionsPanel'),
  clubs: document.getElementById('clubsPanel'),
  sync: document.getElementById('syncPanel')
};

let currentPage = 1;
let totalPages = 1;
let autoRefreshTimer = null;
let currentSubmission = null;

function showLogin() {
  dashboardSection.classList.add('hidden');
  dashboardSection.setAttribute('aria-hidden', 'true');
  loginSection.classList.remove('hidden');
  loginSection.setAttribute('aria-hidden', 'false');
}

function showDashboard() {
  loginSection.classList.add('hidden');
  loginSection.setAttribute('aria-hidden', 'true');
  dashboardSection.classList.remove('hidden');
  dashboardSection.setAttribute('aria-hidden', 'false');
}

function setLoginStatus(message, type = 'error') {
  loginStatus.textContent = message;
  loginStatus.classList.remove('is-error', 'is-success');
  if (message) {
    loginStatus.classList.add(type === 'success' ? 'is-success' : 'is-error');
  }
}

function setListStatus(message, type) {
  listStatus.textContent = message || '';
  listStatus.classList.remove('is-error', 'is-success');
  if (!message) {
    return;
  }
  listStatus.classList.add(type === 'success' ? 'is-success' : 'is-error');
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function createBadge(status) {
  const span = document.createElement('span');
  span.className = 'text-badge';
  switch (status) {
    case 'approved':
      span.classList.add('text-badge--approved');
      span.textContent = '已通过';
      break;
    case 'rejected':
      span.classList.add('text-badge--rejected');
      span.textContent = '已拒绝';
      break;
    default:
      span.classList.add('text-badge--pending');
      span.textContent = '待审核';
  }
  return span;
}

function renderTable(items) {
  tableBody.innerHTML = '';

  if (!items.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = '暂无提交记录';
    cell.style.textAlign = 'center';
    cell.style.padding = '32px 16px';
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = item.data?.name || '-';

    const schoolCell = document.createElement('td');
    schoolCell.textContent = item.data?.school || '-';

    const provinceCell = document.createElement('td');
    provinceCell.textContent = item.data?.province || '-';

    const submittedCell = document.createElement('td');
    submittedCell.textContent = formatDate(item.submittedAt);

    const statusCell = document.createElement('td');
    statusCell.appendChild(createBadge(item.status));

    const actionsCell = document.createElement('td');
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'table-actions';

    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'table-button table-button--primary';
    viewButton.textContent = '查看详情';
    viewButton.addEventListener('click', () => openModal(item._id));

    actionsWrapper.appendChild(viewButton);
    actionsCell.appendChild(actionsWrapper);

    row.append(nameCell, schoolCell, provinceCell, submittedCell, statusCell, actionsCell);
    tableBody.appendChild(row);
  });
}

function renderPagination(pagination) {
  paginationEl.innerHTML = '';
  currentPage = pagination.page;
  totalPages = pagination.totalPages;

  if (totalPages <= 1) {
    return;
  }

  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement('button');
    button.textContent = String(page);
    if (page === currentPage) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      if (page !== currentPage) {
        loadSubmissions(page);
      }
    });
    paginationEl.appendChild(button);
  }
}

async function loadSubmissions(page = 1) {
  try {
    setListStatus('加载中…', 'success');

    const params = new URLSearchParams();
    const status = statusFilter.value;
    const sort = sortSelect.value;

    if (status && status !== 'all') {
      params.set('status', status);
    }
    params.set('page', page);
    params.set('limit', '10');
    if (sort === 'oldest') {
      params.set('sort', 'asc');
    }

    const response = await authFetch(`/api/submissions?${params.toString()}`, {
      method: 'GET'
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || '获取提交列表失败');
    }

    renderTable(result.data.items);
    renderPagination(result.data.pagination);
    setListStatus('', 'success');
  } catch (error) {
    console.error(error);
    setListStatus(error.message || '加载失败，请稍后再试', 'error');
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = window.setInterval(() => {
    loadSubmissions(currentPage);
  }, 60000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function fillList(listElement, entries) {
  listElement.innerHTML = '';
  entries.forEach(([term, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value ?? '-';
    listElement.append(dt, dd);
  });
}

function renderDuplicateInfo(submission) {
  const info = submission.metadata?.duplicateCheck;
  if (!info || info.passed || !info.similarClubs?.length) {
    duplicateInfo.classList.add('hidden');
    duplicateInfo.innerHTML = '';
    return;
  }

  duplicateInfo.classList.remove('hidden');
  
  const listItems = info.similarClubs.map((club) => {
    if (!club) {
      return '<li>未知社团</li>';
    }

    if (typeof club === 'string') {
      return `<li>类似社团 ID：${club}</li>`;
    }

    const name = club.name || '未知社团';
    const school = club.school || '';
    const id = club.id || club._id || '未知 ID';
    const matchType = club.matchType || 'unknown';
    const confidence = club.confidence ? `${Math.round(club.confidence * 100)}%` : '';
    const distance = club.distance ? `${club.distance}米` : '';
    
    let matchInfo = '';
    if (matchType === 'exact') {
      matchInfo = '<strong style="color: #e74c3c;">完全匹配</strong>';
    } else if (matchType === 'similar') {
      matchInfo = `相似度: ${confidence}`;
    } else if (matchType === 'nearby') {
      matchInfo = `距离: ${distance}`;
    }
    
    return `<li>
      <strong>${name}</strong> ${school ? `(${school})` : ''}
      <br><small>ID: ${id} | ${matchInfo}</small>
    </li>`;
  }).join('');

  duplicateInfo.innerHTML = `
    <p style="margin-bottom: 8px; color: #e67e22;">
      <strong>⚠️ 检测到 ${info.similarClubs.length} 个类似社团，请在批准前再次核对：</strong>
    </p>
    <ul style="margin: 0; padding-left: 20px;">${listItems}</ul>
  `;
}

function buildApproveFooter(submission) {
  modalFooter.innerHTML = '';

  if (submission.status !== 'pending') {
    const info = document.createElement('p');
    info.textContent = submission.status === 'approved'
      ? '该记录已通过审核。'
      : `该记录已被拒绝，原因：${submission.rejectionReason || '未提供原因'}`;
    modalFooter.appendChild(info);
    return;
  }

  const reasonWrapper = document.createElement('div');
  reasonWrapper.style.width = '100%';

  const reasonLabel = document.createElement('label');
  reasonLabel.textContent = '拒绝原因（如需拒绝，请填写）';
  reasonLabel.style.display = 'block';
  reasonLabel.style.fontWeight = '600';
  reasonLabel.style.marginBottom = '8px';

  const reasonTextarea = document.createElement('textarea');
  reasonTextarea.id = 'rejectionReason';
  reasonTextarea.placeholder = '请填写拒绝原因，方便提交者修改后重新提交。';

  reasonWrapper.append(reasonLabel, reasonTextarea);

  const buttonsWrapper = document.createElement('div');
  buttonsWrapper.className = 'table-actions';

  const rejectButton = document.createElement('button');
  rejectButton.type = 'button';
  rejectButton.className = 'table-button table-button--danger';
  rejectButton.textContent = '拒绝';
  rejectButton.addEventListener('click', () => handleReject(submission._id, reasonTextarea));

  const approveButton = document.createElement('button');
  approveButton.type = 'button';
  approveButton.className = 'table-button table-button--primary';
  approveButton.textContent = '批准';
  approveButton.addEventListener('click', () => handleApprove(submission._id));

  buttonsWrapper.append(rejectButton, approveButton);

  modalFooter.append(reasonWrapper, buttonsWrapper);
}

function toggleModal(isOpen) {
  if (isOpen) {
    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
    modalFooter.innerHTML = '';
    duplicateInfo.innerHTML = '';
    duplicateInfo.classList.add('hidden');
    currentSubmission = null;
  }
}

function createCoordinateText(coordinates) {
  if (!coordinates) {
    return '-';
  }
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    return `经度：${coordinates[0]}，纬度：${coordinates[1]}`;
  }
  if (coordinates.longitude !== undefined && coordinates.latitude !== undefined) {
    return `经度：${coordinates.longitude}，纬度：${coordinates.latitude}`;
  }
  return '-';
}

function formatExternalLinks(links) {
  if (!links || !Array.isArray(links) || links.length === 0) {
    return '未提供';
  }
  return links.map(link => `${link.type}: ${link.url}`).join(' | ');
}

function renderDetail(submission) {
  currentSubmission = submission;

  // Determine if this is an edit submission
  const isEdit = submission.submissionType === 'edit';
  
  // Basic club info
  const clubInfo = [
    ['提交类型', isEdit ? '<span style="color: #f39c12; font-weight: bold;">✏️ 编辑现有社团</span>' : '<span style="color: #27ae60; font-weight: bold;">➕ 新增社团</span>']
  ];

  if (isEdit && submission.editingClubId) {
    clubInfo.push(['编辑社团 ID', submission.editingClubId]);
  }

  clubInfo.push(
    ['社团名称', submission.data?.name || '-'],
    ['所属学校', submission.data?.school || '-'],
    ['省份', submission.data?.province || '-'],
    ['城市', submission.data?.city || '-'],
    ['坐标', createCoordinateText(submission.data?.coordinates)],
    ['标签', submission.data?.tags?.join(', ') || '无'],
    ['短简介', submission.data?.shortDescription || '未提供'],
    ['长简介', submission.data?.description || '未提供'],
    ['Logo', submission.data?.logo || '未上传'],
    ['外部链接', formatExternalLinks(submission.data?.externalLinks)]
  );

  fillList(clubInfoList, clubInfo);

  fillList(metaInfoList, [
    ['提交邮箱', submission.submitterEmail || '-'],
    ['提交时间', formatDate(submission.submittedAt)],
    ['当前状态', submission.status],
    ['审核人', submission.reviewedBy || '未处理'],
    ['审核时间', submission.reviewedAt ? formatDate(submission.reviewedAt) : '未处理'],
    ['提交 IP', submission.metadata?.ipAddress || '未知'],
    ['客户端', submission.metadata?.userAgent || '未知']
  ]);

  // Display comparison if edit mode
  if (isEdit && submission.originalData) {
    renderEditComparison(submission);
  }

  renderDuplicateInfo(submission);
  buildApproveFooter(submission);
}

function renderEditComparison(submission) {
  const original = submission.originalData;
  const updated = submission.data;

  const comparisonSection = document.createElement('div');
  comparisonSection.style.marginTop = '20px';
  comparisonSection.style.padding = '16px';
  comparisonSection.style.background = '#fff3cd';
  comparisonSection.style.border = '1px solid #ffc107';
  comparisonSection.style.borderRadius = '6px';

  const title = document.createElement('h3');
  title.textContent = '📝 修改对比';
  title.style.marginTop = '0';
  title.style.color = '#856404';

  const comparisonTable = document.createElement('table');
  comparisonTable.style.width = '100%';
  comparisonTable.style.borderCollapse = 'collapse';
  comparisonTable.style.marginTop = '12px';

  const fields = [
    { key: 'name', label: '社团名称' },
    { key: 'school', label: '所属学校' },
    { key: 'province', label: '省份' },
    { key: 'city', label: '城市' },
    { key: 'coordinates', label: '坐标' },
    { key: 'shortDescription', label: '短简介' },
    { key: 'description', label: '长简介' },
    { key: 'tags', label: '标签' },
    { key: 'logo', label: 'Logo' },
    { key: 'externalLinks', label: '外部链接' }
  ];

  // Helper function to format coordinates
  const formatCoordinates = (coordData) => {
    if (!coordData) return '未提供';
    
    // Handle array format [longitude, latitude]
    if (Array.isArray(coordData)) {
      if (coordData.length === 2) {
        return `经度：${coordData[0]}，纬度：${coordData[1]}`;
      }
      return '未提供';
    }
    
    // Handle object format { longitude, latitude }
    if (typeof coordData === 'object') {
      if (coordData.longitude !== undefined && coordData.latitude !== undefined) {
        return `经度：${coordData.longitude}，纬度：${coordData.latitude}`;
      }
    }
    
    return '未提供';
  };

  fields.forEach(field => {
    let oldValue, newValue;
    
    if (field.key === 'coordinates') {
      oldValue = formatCoordinates(original.coordinates);
      newValue = formatCoordinates(updated.coordinates);
    } else if (field.key === 'tags' && Array.isArray(original[field.key])) {
      oldValue = original[field.key].join(', ');
    } else if (field.key === 'externalLinks' && Array.isArray(original[field.key])) {
      oldValue = formatExternalLinks(original[field.key]);
    } else {
      oldValue = original[field.key] || '未提供';
    }
    
    if (field.key === 'tags' && Array.isArray(updated[field.key])) {
      newValue = updated[field.key].join(', ');
    } else if (field.key === 'externalLinks' && Array.isArray(updated[field.key])) {
      newValue = formatExternalLinks(updated[field.key]);
    } else if (field.key !== 'coordinates') {
      newValue = updated[field.key] || '未提供';
    }

    const hasChanged = oldValue !== newValue;

    if (hasChanged) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 120px;">${field.label}</td>
        <td style="padding: 8px; border: 1px solid #ddd; background: #ffe6e6; text-decoration: line-through;">${oldValue}</td>
        <td style="padding: 8px; border: 1px solid #ddd; background: #e6ffe6; font-weight: bold;">${newValue}</td>
      `;
      comparisonTable.appendChild(row);
    }
  });

  if (comparisonTable.children.length === 0) {
    comparisonSection.innerHTML = '<p style="color: #856404; margin: 0;">未检测到字段变化</p>';
  } else {
    comparisonSection.appendChild(title);
    comparisonSection.appendChild(comparisonTable);
  }

  // Insert comparison section before duplicate info
  const duplicateInfoEl = document.getElementById('duplicateInfo');
  if (duplicateInfoEl) {
    duplicateInfoEl.insertAdjacentElement('beforebegin', comparisonSection);
  } else {
    // Fallback: append to detail body
    detailBody.appendChild(comparisonSection);
  }
}

async function openModal(id) {
  try {
    const response = await authFetch(`/api/submissions/${id}`, {
      method: 'GET'
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || '获取提交详情失败');
    }

    renderDetail(result.data);
    toggleModal(true);
  } catch (error) {
    console.error(error);
    setListStatus(error.message || '无法打开详情', 'error');
  }
}

async function handleApprove(id) {
  try {
    setListStatus('正在批准提交…', 'success');
    const response = await authFetch(`/api/submissions/${id}/approve`, {
      method: 'PUT'
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || '批准失败');
    }

    setListStatus('提交已批准并生成社团记录', 'success');
    toggleModal(false);
    await loadSubmissions(currentPage);
  } catch (error) {
    console.error(error);
    setListStatus(error.message || '批准失败，请稍后再试', 'error');
  }
}

async function handleReject(id, reasonInput) {
  const reason = reasonInput.value.trim();
  if (!reason) {
    reasonInput.focus();
    setListStatus('拒绝前请填写原因', 'error');
    return;
  }

  try {
    setListStatus('正在拒绝提交…', 'success');
    const response = await authFetch(`/api/submissions/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ rejectionReason: reason })
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || '拒绝失败');
    }

    setListStatus('提交已拒绝，原因已记录', 'success');
    toggleModal(false);
    await loadSubmissions(currentPage);
  } catch (error) {
    console.error(error);
    setListStatus(error.message || '拒绝失败，请稍后再试', 'error');
  }
}

function attachEventListeners() {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginStatus('正在登录…', 'success');
    loginButton.disabled = true;

    const username = loginForm.username.value.trim();
    const password = loginForm.password.value;

    if (!username || !password) {
      setLoginStatus('请输入用户名和密码');
      loginButton.disabled = false;
      return;
    }

    try {
      const user = await login(username, password);
      setLoginStatus('登录成功，正在跳转…', 'success');
      enterDashboard(user);
    } catch (error) {
      setLoginStatus(error.message || '登录失败，请稍后再试');
    } finally {
      loginButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', () => {
    clearSession();
    stopAutoRefresh();
    showLogin();
    setListStatus('', 'success');
  });

  // 标签页切换
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      console.log('Switching to tab:', targetTab);
      
      // 更新按钮状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // 切换面板
      Object.keys(tabPanels).forEach(key => {
        if (key === targetTab) {
          tabPanels[key].classList.add('active');
        } else {
          tabPanels[key].classList.remove('active');
        }
      });

      // 初始化社团管理面板（首次切换时）
      if (targetTab === 'clubs' && !window.clubsInitialized) {
        console.log('Initializing clubs management...');
        initClubsManagement();
        window.clubsInitialized = true;
      }
    });
  });

  statusFilter.addEventListener('change', () => loadSubmissions(1));
  sortSelect.addEventListener('change', () => loadSubmissions(1));
  refreshButton.addEventListener('click', () => loadSubmissions(currentPage));
  closeModalButton.addEventListener('click', () => toggleModal(false));
  modalBackdrop.addEventListener('click', () => toggleModal(false));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !detailModal.classList.contains('hidden')) {
      toggleModal(false);
    }
  });
}

function enterDashboard(user) {
  adminDisplay.textContent = `${user.username}（${user.role === 'super_admin' ? '超级管理员' : '审核员'}）`;
  showDashboard();
  loadSubmissions(1);
  startAutoRefresh();
}

async function bootstrap() {
  attachEventListeners();
  const storedUser = getStoredUser();

  if (!storedUser) {
    showLogin();
    return;
  }

  try {
    const user = await verifyToken();
    enterDashboard(user);
  } catch (error) {
    if (error.message === 'SERVICE_UNAVAILABLE') {
      console.warn('数据库连接问题，5秒后重试...');
      // 显示一个临时的加载状态
      const loginSection = document.getElementById('loginSection');
      const originalContent = loginSection.innerHTML;
      loginSection.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <h2>连接中...</h2>
          <p>数据库连接暂时不可用，正在重试...</p>
          <div style="margin: 20px 0;">
            <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          </div>
          <button id="retryLogin" class="secondary-button" style="margin-top: 20px;">手动重试</button>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      document.getElementById('retryLogin').addEventListener('click', () => {
        location.reload();
      });

      // 5秒后自动重试
      setTimeout(() => {
        location.reload();
      }, 5000);
      return;
    }

    console.warn('自动登录失败：', error.message);
    clearSession();
    showLogin();
  }
}

bootstrap();
