import { login, verifyToken, clearSession, authFetch, getStoredUser } from './auth.js';

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
    const id = club._id || '未知 ID';
    return `<li>${name}（ID：${id}）</li>`;
  }).join('');
  duplicateInfo.innerHTML = `
    <strong>可能的重复记录</strong>
    <p>系统检测到以下类似社团，请在批准前再次核对：</p>
    <ul>${listItems}</ul>
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

function renderDetail(submission) {
  currentSubmission = submission;

  fillList(clubInfoList, [
    ['社团名称', submission.data?.name || '-'],
    ['所属学校', submission.data?.school || '-'],
    ['省份', submission.data?.province || '-'],
    ['城市', submission.data?.city || '-'],
    ['坐标', createCoordinateText(submission.data?.coordinates)],
    ['标签', submission.data?.tags?.join(', ') || '无'],
    ['简介', submission.data?.description || '未提供'],
    ['Logo', submission.data?.logo || '未上传'],
    ['网站', submission.data?.website || '未提供']
  ]);

  fillList(metaInfoList, [
    ['提交邮箱', submission.submitterEmail || '-'],
    ['提交时间', formatDate(submission.submittedAt)],
    ['当前状态', submission.status],
    ['审核人', submission.reviewedBy || '未处理'],
    ['审核时间', submission.reviewedAt ? formatDate(submission.reviewedAt) : '未处理'],
    ['提交 IP', submission.metadata?.ipAddress || '未知'],
    ['客户端', submission.metadata?.userAgent || '未知']
  ]);

  renderDuplicateInfo(submission);
  buildApproveFooter(submission);
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
    console.warn('自动登录失败：', error.message);
    clearSession();
    showLogin();
  }
}

bootstrap();
