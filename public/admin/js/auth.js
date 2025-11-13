const TOKEN_KEY = 'gamedevmap_admin_token';
const USER_KEY = 'gamedevmap_admin_user';

function persistSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function loadStoredUser() {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('无法解析本地存储的用户信息，将清除。');
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  return loadStoredUser();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function ensureJson(response) {
  return response.json().catch(() => null);
}

function showServiceUnavailableMessage() {
  // 创建或更新服务不可用消息
  let messageDiv = document.getElementById('service-unavailable-message');
  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.id = 'service-unavailable-message';
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 15px 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(messageDiv);
  }

  messageDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="color: #856404; font-size: 18px;">⏳</div>
      <div>
        <div style="font-weight: 600; color: #856404; margin-bottom: 4px;">服务暂时不可用</div>
        <div style="font-size: 14px; color: #856404; line-height: 1.4;">
          数据库连接暂时不可用，请稍后再试。页面将在连接恢复后自动刷新。
        </div>
      </div>
    </div>
    <button onclick="this.parentElement.parentElement.remove()" style="
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      color: #856404;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    ">×</button>
  `;

  // 自动重试认证检查
  setTimeout(() => {
    checkAuth();
  }, 10000); // 10秒后重试
}

export async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const result = await ensureJson(response);

  if (!response.ok || !result?.success) {
    // 优先使用后端返回的详细错误信息
    let errorMessage = result?.message || '登录失败';
    
    // 根据状态码补充更详细的错误信息
    if (!response.ok) {
      if (response.status === 400) {
        errorMessage = result?.message || '请输入用户名和密码';
      } else if (response.status === 401) {
        errorMessage = result?.message || '账号或密码错误，请检查输入';
      } else if (response.status === 403) {
        errorMessage = result?.message || '该账号已被禁用';
      } else if (response.status === 429) {
        errorMessage = '登录尝试次数过多，请稍后再试';
      } else if (response.status >= 500) {
        errorMessage = '服务器错误，请稍后再试';
      }
    }
    
    throw new Error(errorMessage);
  }

  persistSession(result.data.token, result.data.user);
  return result.data.user;
}

export async function verifyToken() {
  const token = getToken();
  if (!token) {
    throw new Error('缺少登录凭证');
  }

  const response = await fetch('/api/auth/verify', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await ensureJson(response);

  if (!response.ok || !result?.success) {
    // 如果是服务不可用（数据库连接问题），不要清除session
    if (response.status === 503 || result?.error === 'SERVICE_UNAVAILABLE') {
      console.warn('数据库连接暂时不可用，稍后重试...');
      throw new Error('SERVICE_UNAVAILABLE');
    }

    clearSession();
    let errorMessage = result?.message || '登录状态已失效，请重新登录';

    // 根据状态码补充更详细的错误信息
    if (!response.ok) {
      if (response.status === 401) {
        errorMessage = result?.message || 'Token已过期或无效，请重新登录';
      } else if (response.status === 403) {
        errorMessage = result?.message || '权限不足';
      } else if (response.status >= 500) {
        errorMessage = '服务器错误，请稍后再试';
      }
    }

    throw new Error(errorMessage);
  }

  persistSession(token, result.data.user);
  return result.data.user;
}

export async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('缺少登录凭证');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}

export function getAuthHeaders() {
  const token = getToken();
  if (!token) {
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`
  };
}

export async function checkAuth() {
  const storedUser = getStoredUser();
  if (!storedUser) {
    // 没有存储的用户信息，不重定向
    console.log('No stored user, waiting for login...');
    return false;
  }

  try {
    // 验证 token 是否仍然有效
    await verifyToken();
    return true;
  } catch (error) {
    console.warn('认证检查失败：', error.message);

    // 如果是服务不可用（数据库连接问题），不要重定向，显示等待消息
    if (error.message === 'SERVICE_UNAVAILABLE') {
      console.warn('数据库连接暂时不可用，显示等待状态...');
      showServiceUnavailableMessage();
      return false;
    }

    // Token 无效或已过期，清除会话
    clearSession();
    return false;
  }
}

export async function logout() {
  clearSession();
  window.location.href = '/admin/';
}
