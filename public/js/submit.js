/**
 * 表单提交脚本 (submit.html)
 * 
 * 核心功能：
 *   - 社团信息表单收集与验证
 *   - Logo 和二维码上传管理（支持预览）
 *   - 外部链接编辑（支持多个链接的增删改）
 *   - 表单数据 JSON 预览和最终提交
 *   - 页面状态管理和用户交互反馈
 * 
 * 依赖模块：
 *   - config.js (PROVINCES, API_ENDPOINTS, LIMITS) - 全局配置
 *   - utils.js (escapeHtmlAttr, parseTags, 等工具函数) - 可复用功能
 *   - debug-panel.js (addDebugLog) - 调试日志
 * 
 * 被依赖：submit.html
 */

// 调试收集器：用于在表单提交时收集一组调试信息，最终一次性输出到 debug-panel
let debugReport = null;
function startDebugReport() {
  debugReport = [];
}
function pushDebug(msg) {
  if (debugReport) debugReport.push(msg);
}
function flushDebug(payload) {
  if (!debugReport) return;
  try {
    // 将收集到的调试信息合并并输出
    const combined = debugReport.join('\n');
    if (combined) addDebugLog(combined);
    // 输出 externalLinks 的最终数量以及完整 payload
    addDebugLog(`📤 externalLinks 最终有 ${payload.externalLinks ? payload.externalLinks.length : 0} 个`);
    addDebugLog('📤 【提交】发送的完整 payload: ' + JSON.stringify(payload, null, 2));
  } finally {
    debugReport = null;
  }
}

const form = document.getElementById('submissionForm');
const provinceSelect = document.getElementById('province');
const submitButton = document.getElementById('submitButton');
const statusBox = document.getElementById('formStatus');
const logoInput = document.getElementById('logo');

const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const tagsInput = document.getElementById('tags');
const shortDescriptionInput = document.getElementById('shortDescription');
const longDescriptionInput = document.getElementById('longDescription');

// Links management
const linksContainer = document.getElementById('linksContainer');
const addLinkBtn = document.getElementById('addLinkBtn');

// Edit mode elements
const toggleEditMode = document.getElementById('toggleEditMode');
const clubSearchSection = document.getElementById('clubSearchSection');
const clubSearchInput = document.getElementById('clubSearchInput');
const searchResults = document.getElementById('searchResults');
const selectedClubInfo = document.getElementById('selectedClubInfo');

// Edit mode interface elements
const editModeInterface = document.getElementById('editModeInterface');
const editForm = document.getElementById('editForm');
const editFormTitle = document.getElementById('editFormTitle');
const editFormContent = document.getElementById('editFormContent');
const cancelEdit = document.getElementById('cancelEdit');
const saveEdit = document.getElementById('saveEdit');

// Confirm edit actions
const confirmEditActions = document.getElementById('confirmEditActions');
const confirmEdit = document.getElementById('confirmEdit');
const cancelAllEdits = document.getElementById('cancelAllEdits');
const editSubmitterEmail = document.getElementById('editSubmitterEmail');

// Edit form buttons
const confirmFieldEdit = document.getElementById('confirmFieldEdit');

// Display elements
const displayElements = {
  name: document.getElementById('displayName'),
  school: document.getElementById('displaySchool'),
  location: document.getElementById('displayLocation'),
  coordinates: document.getElementById('displayCoordinates'),
  shortDescription: document.getElementById('displayShortDescription'),
  longDescription: document.getElementById('displayLongDescription'),
  tags: document.getElementById('displayTags'),
  externalLinks: document.getElementById('displayExternalLinks'),
  logo: document.getElementById('currentLogo'),
  logoPlaceholder: document.getElementById('logoPlaceholder')
};

let currentMode = 'new'; // 'new' or 'edit'
let selectedClub = null;
let currentEditingField = null;
let formData = new Map(); // Store edited form data

/**
 * Update confirm edit actions visibility based on form data
 */
function updateConfirmEditVisibility() {
  if (currentMode === 'edit' && formData.size > 0) {
    confirmEditActions.style.display = 'block';
  } else {
    confirmEditActions.style.display = 'none';
  }
}

/**
 * Populate the province dropdown.
 */
function populateProvinces() {
  const fragment = document.createDocumentFragment();
  PROVINCES.forEach(province => {
    const option = document.createElement('option');
    option.value = province;
    option.textContent = province;
    fragment.appendChild(option);
  });
  provinceSelect.appendChild(fragment);
}

/**
 * Show feedback to user.
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.classList.remove('is-success', 'is-error');
  if (type === 'success') {
    statusBox.classList.add('is-success');
  } else if (type === 'error') {
    statusBox.classList.add('is-error');
  }
}

function clearStatus() {
  statusBox.textContent = '';
  statusBox.classList.remove('is-success', 'is-error');
}

/**
 * Collect links from the dynamic links container.
 * @param {HTMLElement} container - 链接容器元素，默认为linksContainer
 * @returns {Array} 链接数组
 */
function collectLinks(container = linksContainer) {
  const linkItems = container.querySelectorAll('.link-item');
  const links = [];

  pushDebug(`🔍 开始收集链接，找到 ${linkItems.length} 个链接项`);

  linkItems.forEach((item, index) => {
    pushDebug(`  [链接${index + 1}] 开始处理...`);
    
    const typeInput = item.querySelector('.link-type-input') || 
                      item.querySelector('[name="linkType"]') || 
                      item.querySelector('.link-type');
    
    const urlInput = item.querySelector('.link-url-input') || 
                     item.querySelector('[name="linkUrl"]') || 
                     item.querySelector('.link-url');
    
    if (typeInput) {
      try {
        const type = (typeInput.value || '').trim();
        const url = urlInput ? (urlInput.value || '').trim() : '';
        const qrcode = item.dataset.qrcodePath || '';

        pushDebug(`  [链接${index + 1}] type="${type}", url="${url}", qrcode="${qrcode}"`);

        if (type && (url || qrcode)) {
          const link = { type };
          
          if (url) {
            // 如果URL不包含协议前缀，自动添加https://
            let processedUrl = url;
            if (url && !url.includes('://')) {
              processedUrl = 'https://' + url;
              pushDebug(`  🔗 [链接${index + 1}] 自动添加https://前缀: "${url}" -> "${processedUrl}"`);
            }
            link.url = processedUrl;
          }
          
          if (qrcode) {
            // 提取QR码文件名（去除路径前缀）
            let qrcodeFilename = qrcode;
            if (qrcode.includes('/')) {
              qrcodeFilename = qrcode.split('/').pop();
            }
            link.qrcode = qrcodeFilename;
            pushDebug(`  📷 [链接${index + 1}] QR码文件名: "${qrcode}" -> "${qrcodeFilename}"`);
          }
          
          pushDebug(`  ✅ [链接${index + 1}] 添加成功: ${JSON.stringify(link)}`);
          links.push(link);
        } else {
          pushDebug(`  ❌ [链接${index + 1}] 不满足条件 (需要 type 和 (url 或 qrcode))`);
        }
      } catch (error) {
        pushDebug(`  ❌ [链接${index + 1}] 错误: ${error.message}`);
      }
    } else {
      pushDebug(`  ❌ [链接${index + 1}] 找不到 typeInput`);
    }
  });

  pushDebug(`🎯 链接收集完毕，共 ${links.length} 个`);
  return links;
}

/**
 * Create a new link item in the links container.
 */
function addNewLinkItem() {
  const linkItem = document.createElement('div');
  linkItem.className = 'link-item';
  linkItem.innerHTML = `
    <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (如: 网站, GitHub, 微博等)">
    <input type="url" name="linkUrl" class="link-url-input" placeholder="输入链接地址或ID">
    <button type="button" class="toggle-qrcode-btn" title="添加二维码">二维码</button>
    <button type="button" class="remove-link-btn">删除</button>
    <div class="qrcode-section" style="display: none;">
      <input type="file" name="qrcode" accept="image/*" class="qrcode-input" style="display: none;">
      <button type="button" class="upload-qrcode-btn">上传二维码</button>
      <div class="qrcode-preview" style="display: none;">
        <img src="" alt="二维码预览">
        <button type="button" class="remove-qrcode-btn" title="移除二维码">✕</button>
      </div>
    </div>
  `;

  const removeBtn = linkItem.querySelector('.remove-link-btn');
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    linkItem.remove();
    updateRemoveButtonVisibility();
  });

  // Attach QR code handlers to the new link item
  attachQrcodeHandlersToItem(linkItem);

  linksContainer.appendChild(linkItem);
  updateRemoveButtonVisibility();
}

/**
 * Attach QR code event handlers to a link item
 * @param {HTMLElement} linkItem - The link item element
 */
function attachQrcodeHandlersToItem(linkItem) {
  const toggleBtn = linkItem.querySelector('.toggle-qrcode-btn');
  const qrcodeSection = linkItem.querySelector('.qrcode-section');
  const uploadBtn = linkItem.querySelector('.upload-qrcode-btn');
  const qrcodeInput = linkItem.querySelector('.qrcode-input');
  const qrcodePreview = linkItem.querySelector('.qrcode-preview');
  const removeQrcodeBtn = linkItem.querySelector('.remove-qrcode-btn');
  const urlInput = linkItem.querySelector('.link-url-input');

  // Toggle QR code section visibility and disable/enable URL input
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isVisible = qrcodeSection.style.display !== 'none';
    qrcodeSection.style.display = isVisible ? 'none' : 'block';
    toggleBtn.classList.toggle('active', !isVisible);
    
    // 禁用URL输入当QR码部分显示时
    urlInput.disabled = !isVisible;
    if (!isVisible) {
      urlInput.value = ''; // 清空URL值
    }
  });

  // Trigger file input when upload button is clicked
  uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    qrcodeInput.click();
  });

  // 处理文件选择和预览
  qrcodeInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Show loading state
        uploadBtn.disabled = true;
        uploadBtn.textContent = '上传中...';
        
        pushDebug(`⬆️ 开始上传二维码: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);
        
        // Upload the QR code
        const qrcodePath = await uploadQRCode(file);
        
        pushDebug(`✅ 二维码上传成功: ${qrcodePath}`);
        
        // Store the uploaded path in a data attribute
        linkItem.dataset.qrcodePath = qrcodePath;
        
        pushDebug(`💾 保存到 linkItem.dataset.qrcodePath: ${linkItem.dataset.qrcodePath}`);
        
        // Show preview
        previewQrcode(file, qrcodePreview, uploadBtn);
        
        uploadBtn.disabled = false;
        uploadBtn.textContent = '上传二维码';
      } catch (error) {
        console.error('QR code upload failed:', error);
        pushDebug(`❌ 二维码上传失败: ${error.message}`);
        alert(error.message || '二维码上传失败，请重试');
        uploadBtn.disabled = false;
        uploadBtn.textContent = '上传二维码';
        qrcodeInput.value = '';
      }
    }
  });

  // Remove QR code preview
  removeQrcodeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    qrcodeInput.value = '';
    qrcodePreview.style.display = 'none';
    uploadBtn.style.display = 'block';
    delete linkItem.dataset.qrcodePath; // Clear stored path
    
    // 隐藏QR码部分并重新启用URL输入
    qrcodeSection.style.display = 'none';
    toggleBtn.classList.remove('active');
    urlInput.disabled = false;
  });
}

/**
 * Preview QR code image
 * @param {File} file - QR code image file
 * @param {HTMLElement} previewContainer - Preview container element
 * @param {HTMLElement} uploadBtn - Upload button to hide after preview
 */
function previewQrcode(file, previewContainer, uploadBtn) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = previewContainer.querySelector('img');
    img.src = e.target.result;
    previewContainer.style.display = 'flex';
    uploadBtn.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

/**
 * Attach QR code handlers to all existing link items
 */
function attachQrcodeHandlers() {
  const linkItems = linksContainer.querySelectorAll('.link-item');
  linkItems.forEach(item => attachQrcodeHandlersToItem(item));
}

/**
 * Handle link removal for both new and edit modes
 */
function handleRemoveLinkClick(e) {
  const linkItem = e.target.closest('.link-item');
  if (linkItem) {
    linkItem.remove();
    updateRemoveButtonVisibility();
  }
}

/**
 * Update visibility of remove buttons based on number of links.
 */
function updateRemoveButtonVisibility() {
  const linkItems = linksContainer.querySelectorAll('.link-item');
  linkItems.forEach((item, index) => {
    const removeBtn = item.querySelector('.remove-link-btn');
    // Show remove button only if there are more than 1 item
    removeBtn.style.display = linkItems.length > 1 ? 'block' : 'none';
  });
}

function toggleLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? '提交中…' : '提交信息';
}

function resetForm() {
  form.reset();
  clearStatus();
  provinceSelect.value = '';
  // 清空文件输入
  if (logoInput) {
    logoInput.value = '';
  }
  // 清空链接容器，只保留一个空的
  linksContainer.innerHTML = ``;
  addNewLinkItem(); // 使用 addNewLinkItem 来创建初始项，确保绑定了事件处理器
  updateRemoveButtonVisibility();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearStatus();

  if (!form.reportValidity()) {
    showStatus('请检查必填项是否填写完整', 'error');
    return;
  }

  // 验证链接完整性：如果有URL或二维码，必须填写类型
  const linkItems = linksContainer.querySelectorAll('.link-item');
  for (const item of linkItems) {
    const typeInput = item.querySelector('.link-type-input');
    const urlInput = item.querySelector('.link-url-input');
    const hasQrcode = !!item.dataset.qrcodePath;
    const hasUrl = urlInput ? !!urlInput.value.trim() : false;
    const hasType = typeInput ? !!typeInput.value.trim() : false;

    if ((hasQrcode || hasUrl) && !hasType) {
      showStatus('请为所有链接填写"链接类型"（如：微信群、官网等）', 'error');
      if (typeInput) typeInput.focus();
      return;
    }
  }

  toggleLoading(true);

  try {
    // Use formData values if in edit mode, otherwise use form inputs
    let latitude, longitude, tags, links, payload;
    
    // 开始收集调试信息（将在提交时一次性输出）
    startDebugReport();
    pushDebug('📋 === 开始收集表单数据 ===');
    
    if (currentMode === 'edit') {
      // In edit mode, start with original club data and override with edited fields
      if (!selectedClub) {
        throw new Error('未选择要编辑的社团');
      }
      
      // Get submitter email from the edit mode email input
      const submitterEmail = editSubmitterEmail.value.trim();
      if (!submitterEmail) {
        throw new Error('请输入提交者邮箱');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
        throw new Error('请输入有效的邮箱地址');
      }
      
      // Get coordinates - use edited values if available, otherwise use original
      let latitude, longitude;
      const latStr = formData.get('latitude');
      const lngStr = formData.get('longitude');
      
      if (latStr && lngStr) {
        latitude = parseFloat(latStr);
        longitude = parseFloat(lngStr);
      } else if (selectedClub.coordinates && Array.isArray(selectedClub.coordinates)) {
        // 新格式：coordinates 数组 [longitude, latitude]
        longitude = selectedClub.coordinates[0];
        latitude = selectedClub.coordinates[1];
      } else if (selectedClub.latitude !== undefined && selectedClub.longitude !== undefined) {
        // 旧格式：分离的 latitude/longitude 字段
        latitude = selectedClub.latitude;
        longitude = selectedClub.longitude;
      } else {
        throw new Error('无法获取有效的坐标信息');
      }
      
      latitude = parseFloat(latitude);
      longitude = parseFloat(longitude);
      validateCoordinates(latitude, longitude);
      
      // Get tags - use edited values if available, otherwise use original
      let tagsValue;
      if (formData.has('tags')) {
        tagsValue = JSON.parse(formData.get('tags'));
      } else {
        tagsValue = selectedClub.tags || [];
      }
      tags = tagsValue;
      
      // Get external links - collect from form
      links = collectLinks();
      
      payload = {
        submissionType: currentMode,
        editingClubId: `${selectedClub.name}|${selectedClub.school}`,
        name: formData.get('name') || selectedClub.name || '',
        school: formData.get('school') || selectedClub.school || '',
        province: formData.get('province') || selectedClub.province || '',
        city: formData.get('city') || selectedClub.city || '',
        coordinates: {
          latitude,
          longitude
        },
        shortDescription: formData.get('shortDescription') || selectedClub.shortDescription || '',
        description: formData.get('description') || selectedClub.description || '',
        tags,
        externalLinks: links,
        submitterEmail: submitterEmail
      };
    } else {
      // Original logic for new submissions
      latitude = parseFloat(latitudeInput.value.trim());
      longitude = parseFloat(longitudeInput.value.trim());
      validateCoordinates(latitude, longitude);

      tags = parseTags(tagsInput.value);
      links = collectLinks();

      payload = {
        submissionType: currentMode,
        name: document.getElementById('name').value.trim(),
        school: document.getElementById('school').value.trim(),
        province: provinceSelect.value,
        city: document.getElementById('city').value.trim(),
        coordinates: {
          latitude,
          longitude
        },
        shortDescription: shortDescriptionInput.value.trim(),
        description: longDescriptionInput.value.trim(),
        tags,
        externalLinks: links,
        submitterEmail: document.getElementById('submitterEmail').value.trim()
      };
      
      // externalLinks 的数量将在 flushDebug 时输出
    }

    const logoFile = logoInput.files?.[0];
    if (logoFile) {
      const logoPath = await uploadLogo(logoFile);
      payload.logo = logoPath;
    } else if (currentMode === 'edit') {
      // In edit mode, preserve the original logo if no new logo is uploaded
      payload.logo = selectedClub.logo || formData.get('logo') || '';
    }

    // 输出本次提交的调试信息（包含链接处理过程和最终 payload）
    flushDebug(payload);

    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      // 提供更详细的错误信息
      let errorMessage = result?.message || '提交失败，请稍后再试';
      
      if (response.status === 503 || result?.error === 'SERVICE_UNAVAILABLE') {
        errorMessage = '数据库连接暂时不可用，请稍后再试';
      } else if (result?.errors?.length) {
        const details = result.errors.map(err => `• ${err.message}`).join('\n');
        errorMessage = `${result.message || '提交失败'}\n${details}`;
      }
      
      console.error('Submission failed:', {
        status: response.status,
        error: result?.error,
        message: result?.message,
        errors: result?.errors
      });
      
      throw new Error(errorMessage);
    }

    resetForm();
    showStatus(result.message || '提交成功！感谢您的贡献，我们将尽快审核。', 'success');
  } catch (error) {
    showStatus(error.message || '提交失败，请稍后再试', 'error');
  } finally {
    toggleLoading(false);
  }
});

// Add event listener for the "Add Link" button
addLinkBtn.addEventListener('click', (e) => {
  e.preventDefault();
  addNewLinkItem();
});

// Initialize QR code handlers for existing link items on page load
// attachQrcodeHandlers(); // No longer needed as we create items dynamically

// Initialize the first link item
if (linksContainer.children.length === 0) {
  addNewLinkItem();
}

// 为编辑模式添加链接按钮事件处理
document.addEventListener('click', (e) => {
  if (e.target.id === 'addEditLinkBtn' || e.target.className === 'add-link-btn') {
    e.preventDefault();
    const editContainer = document.getElementById('editLinksContainer');
    if (editContainer) {
      // 在编辑表单中添加链接
      addLinkToContainer(editContainer);
    } else {
      // 在主容器中添加链接
      addNewLinkItem();
    }
  }
});

/**
 * 添加链接到指定容器
 */
function addLinkToContainer(container) {
  const linkItem = document.createElement('div');
  linkItem.className = 'link-item';
  linkItem.innerHTML = `
    <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (如: 网站, GitHub, 微博等)">
    <input type="url" name="linkUrl" class="link-url-input" placeholder="输入链接地址或ID">
    <button type="button" class="toggle-qrcode-btn" title="添加二维码">二维码</button>
    <button type="button" class="remove-link-btn">删除</button>
    <div class="qrcode-section" style="display: none;">
      <input type="file" name="qrcode" accept="image/*" class="qrcode-input" style="display: none;">
      <button type="button" class="upload-qrcode-btn">上传二维码</button>
      <div class="qrcode-preview" style="display: none;">
        <img src="" alt="二维码预览">
        <button type="button" class="remove-qrcode-btn" title="移除二维码">✕</button>
      </div>
    </div>
  `;

  const removeBtn = linkItem.querySelector('.remove-link-btn');
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    linkItem.remove();
    // 更新容器中的删除按钮可见性
    updateRemoveButtonsInContainer(container);
  });

  // 附加QR码处理器
  attachQrcodeHandlersToItem(linkItem);

  container.appendChild(linkItem);
  updateRemoveButtonsInContainer(container);
}

/**
 * 更新特定容器中的删除按钮可见性
 */
function updateRemoveButtonsInContainer(container) {
  const linkItems = container.querySelectorAll('.link-item');
  linkItems.forEach((item) => {
    const removeBtn = item.querySelector('.remove-link-btn');
    removeBtn.style.display = linkItems.length > 1 ? 'block' : 'none';
  });
}

// Set up event listeners for initial remove buttons
const initialRemoveButtons = linksContainer.querySelectorAll('.remove-link-btn');
initialRemoveButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    handleRemoveLinkClick(e);
  });
});

// Mode switching
toggleEditMode.addEventListener('click', () => {
  const isActive = toggleEditMode.classList.contains('active');
  
  if (isActive) {
    // Switch to new mode
    toggleEditMode.classList.remove('active');
    currentMode = 'new';
    clubSearchSection.style.display = 'none';
    editModeInterface.style.display = 'none';
    updateConfirmEditVisibility();
    submissionForm.style.display = 'block';
    resetForm();
    selectedClub = null;
    selectedClubInfo.style.display = 'none';
    searchResults.innerHTML = '';
    formData.clear();
  } else {
    // Switch to edit mode
    toggleEditMode.classList.add('active');
    currentMode = 'edit';
    clubSearchSection.style.display = 'block';
    submissionForm.style.display = 'none';
    editModeInterface.style.display = 'none';
    updateConfirmEditVisibility();
  }
});

// Club search (real-time search like homepage)
clubSearchInput.addEventListener('input', async (e) => {
  const query = e.target.value.toLowerCase().trim();
  
  if (query.length < 1) {
    searchResults.innerHTML = '';
    return;
  }
  
  try {
    // Load clubs data if not already loaded
    if (!window.clubsData) {
      const response = await fetch('/data/clubs.json');
      if (!response.ok) {
        throw new Error('Failed to load clubs data');
      }
      window.clubsData = await response.json();
    }
    
    // Search clubs
    const results = window.clubsData.filter(club => 
      club.name.toLowerCase().includes(query) ||
      club.school.toLowerCase().includes(query) ||
      club.city.toLowerCase().includes(query) ||
      (club.tags && club.tags.some(tag => tag.toLowerCase().includes(query)))
    );
    
    displaySearchResults(results.slice(0, 10));
    
  } catch (error) {
    console.error('Search failed:', error);
    searchResults.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText = 'padding: 10px; color: #f44336;';
    p.textContent = '搜索失败，请稍后重试';
    searchResults.appendChild(p);
  }
});

// Display search results
function displaySearchResults(clubs) {
  searchResults.innerHTML = '';
  
  if (clubs.length === 0) {
    const p = document.createElement('p');
    p.style.cssText = 'padding: 10px; color: #999;';
    p.textContent = '未找到匹配的社团';
    searchResults.appendChild(p);
    return;
  }

  clubs.forEach(club => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `
      <h3>${club.name}</h3>
      <p>${club.school} - ${club.city || club.province}</p>
    `;
    div.addEventListener('click', () => selectClub(club));
    searchResults.appendChild(div);
  });
}

// Select a club for editing
function selectClub(club) {
  selectedClub = club;
  
  // Hide search section and show edit interface
  clubSearchSection.style.display = 'none';
  editModeInterface.style.display = 'block';
  updateConfirmEditVisibility();
  
  // Populate the edit interface with club data
  populateEditInterface(club);
}

// Populate the edit interface with club data
function populateEditInterface(club) {
  // Initialize formData with club data
  formData = new Map();
  formData.set('name', club.name || '');
  formData.set('school', club.school || '');
  formData.set('location', club.city ? `${club.city}, ${club.province}` : club.province || '');
  
  // Support both new format (coordinates array) and old format (separate lat/lon)
  let coordsText = '';
  if (club.coordinates && Array.isArray(club.coordinates)) {
    coordsText = `${club.coordinates[1]}, ${club.coordinates[0]}`;
  } else if (club.latitude && club.longitude) {
    coordsText = `${club.latitude}, ${club.longitude}`;
  }
  formData.set('coordinates', coordsText);
  
  formData.set('shortDescription', club.shortDescription || '');
  formData.set('description', club.description || '');
  // Store tags as JSON string for consistency with updateFormData
  formData.set('tags', JSON.stringify(club.tags && club.tags.length > 0 ? club.tags : []));
  formData.set('logo', club.logo || '');

  // Set logo
  const logoToUse = club.logo;
  if (logoToUse) {
    // 检查是否是完整路径（包含 /assets/）
      if (logoToUse.includes('/assets/')) {
      // 直接使用完整路径
      displayElements.logo.src = logoToUse;
      pushDebug(`使用完整路径加载logo: ${logoToUse}`);
    } else {
      // 只有文件名，需要查找
      const logoBase = logoToUse.split('.')[0]; // Remove extension to be format-agnostic
      
      // Try compressed version first (converted to PNG by compress script)
      displayElements.logo.src = `/assets/compressedLogos/${logoBase}.png`;
      pushDebug(`尝试加载压缩logo: /assets/compressedLogos/${logoBase}.png`);
      
      // Add fallback mechanism: if compressed version fails, try original
      displayElements.logo.onerror = function() {
        // Try original logo
        displayElements.logo.src = `/assets/logos/${logoToUse}`;
        pushDebug(`压缩logo不存在，尝试原始logo: /assets/logos/${logoToUse}`);
        displayElements.logo.onerror = function() {
          // Try submissions directory as last resort
          displayElements.logo.src = `/assets/submissions/${logoToUse}`;
          pushDebug(`原始logo不存在，尝试submissions目录: /assets/submissions/${logoToUse}`);
          displayElements.logo.onerror = function() {
            // If all fail, hide and show placeholder
            pushDebug(`所有logo加载方式都失败`);
            displayElements.logo.style.display = 'none';
            displayElements.logoPlaceholder.style.display = 'flex';
          };
        };
      };
    }
    
    displayElements.logo.style.display = 'block';
    displayElements.logoPlaceholder.style.display = 'none';
  } else {
    displayElements.logo.style.display = 'none';
    displayElements.logoPlaceholder.style.display = 'flex';
  }

  // Set text values
  displayElements.name.textContent = club.name || '-';
  displayElements.school.textContent = club.school || '-';
  displayElements.location.textContent = club.city ? `${club.city}, ${club.province}` : club.province || '-';
  
  let coordDisplay = '-';
  if (club.coordinates && Array.isArray(club.coordinates)) {
    coordDisplay = `${club.coordinates[1]}, ${club.coordinates[0]}`;
  } else if (club.latitude && club.longitude) {
    coordDisplay = `${club.latitude}, ${club.longitude}`;
  }
  displayElements.coordinates.textContent = coordDisplay;
  
  displayElements.shortDescription.textContent = club.shortDescription || '-';
  displayElements.longDescription.textContent = club.description || '-';
  displayElements.tags.textContent = club.tags && club.tags.length > 0 ? club.tags.join(', ') : '-';
  
  // Display external links
  if (club.externalLinks && club.externalLinks.length > 0) {
    displayElements.externalLinks.textContent = club.externalLinks
      .map(link => `${link.type}`)
      .join(' | ');
  } else {
    displayElements.externalLinks.textContent = '-';
  }

  // Populate external links form from club data
  // Clear existing links first
  linksContainer.innerHTML = '';
  
  // Add links from club data
  if (club.externalLinks && club.externalLinks.length > 0) {
    club.externalLinks.forEach(link => {
      const linkItem = document.createElement('div');
      linkItem.className = 'link-item';
      linkItem.innerHTML = `
        <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)" value="${escapeHtmlAttr(link.type || '')}">
        <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com" value="${escapeHtmlAttr(link.url || '')}">
        <button type="button" class="toggle-qrcode-btn" title="添加二维码">二维码</button>
        <button type="button" class="remove-link-btn" style="padding: 5px 10px;">删除</button>
        <div class="qrcode-section" style="display: none;">
          <input type="file" name="qrcode" accept="image/*" class="qrcode-input" style="display: none;">
          <button type="button" class="upload-qrcode-btn">上传二维码</button>
          <div class="qrcode-preview" style="display: none;">
            <img src="" alt="二维码预览">
            <button type="button" class="remove-qrcode-btn" title="移除二维码">✕</button>
          </div>
        </div>
      `;
      
      // 存储已有的QR码路径，并自动展开
      if (link.qrcode) {
        linkItem.dataset.qrcodePath = link.qrcode;
        // 显示已有的二维码预览，并自动展开QR码部分
        const qrcodeSection = linkItem.querySelector('.qrcode-section');
        const qrcodePreview = linkItem.querySelector('.qrcode-preview');
        const qrcodeImg = qrcodePreview.querySelector('img');
        const uploadBtn = linkItem.querySelector('.upload-qrcode-btn');
        const toggleBtn = linkItem.querySelector('.toggle-qrcode-btn');
        
        qrcodeImg.src = `/assets/qrcodes/${link.qrcode}`;
        qrcodePreview.style.display = 'flex';
        uploadBtn.style.display = 'none';
        
        // 自动展开QR码部分
        qrcodeSection.style.display = 'block';
        toggleBtn.classList.add('active');
        
        // 禁用URL输入框
        const urlInput = linkItem.querySelector('.link-url-input');
        urlInput.disabled = true;
      }
      
      // Add remove button listener
      const removeBtn = linkItem.querySelector('.remove-link-btn');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleRemoveLinkClick(e);
      });
      
      // 附加QR码处理器
      attachQrcodeHandlersToItem(linkItem);
      
      linksContainer.appendChild(linkItem);
    });
  } else {
    // Add one empty link item if no links exist
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    linkItem.innerHTML = `
      <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)">
      <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com">
      <button type="button" class="toggle-qrcode-btn" title="添加二维码">二维码</button>
      <button type="button" class="remove-link-btn" style="padding: 5px 10px;">删除</button>
      <div class="qrcode-section" style="display: none;">
        <input type="file" name="qrcode" accept="image/*" class="qrcode-input" style="display: none;">
        <button type="button" class="upload-qrcode-btn">上传二维码</button>
        <div class="qrcode-preview" style="display: none;">
          <img src="" alt="二维码预览">
          <button type="button" class="remove-qrcode-btn" title="移除二维码">✕</button>
        </div>
      </div>
    `;
    
    const removeBtn = linkItem.querySelector('.remove-link-btn');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleRemoveLinkClick(e);
    });
    
    // 附加QR码处理器
    attachQrcodeHandlersToItem(linkItem);
    
    linksContainer.appendChild(linkItem);
  }
  
  updateRemoveButtonVisibility();
}

// Handle edit button clicks
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('edit-btn')) {
    const field = e.target.dataset.field;
    if (field) {
      showEditForm(field);
    }
  }
});

// Show edit form for a specific field
function showEditForm(field) {
  // 禁止编辑 name 和 school 字段
  if (field === 'name' || field === 'school') {
    showStatus('社团名称和所属学校不可编辑', 'error');
    return;
  }
  
  currentEditingField = field;
  editFormTitle.textContent = getFieldDisplayName(field);
  editFormContent.innerHTML = generateEditForm(field);
  editForm.style.display = 'block';
  
  // 如果是编辑外链，需要加载现有的链接数据
  if (field === 'externalLinks') {
    populateEditLinksForm();
  }
}

/**
 * 为编辑表单加载外链数据
 */
function populateEditLinksForm() {
  const editLinksContainer = document.getElementById('editLinksContainer');
  if (!editLinksContainer) return;
  
  editLinksContainer.innerHTML = '';
  
  if (selectedClub && selectedClub.externalLinks && selectedClub.externalLinks.length > 0) {
    selectedClub.externalLinks.forEach(link => {
      const linkItem = document.createElement('div');
      linkItem.className = 'link-item';
      linkItem.innerHTML = `
        <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)" value="${escapeHtmlAttr(link.type || '')}">
        <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com" value="${escapeHtmlAttr(link.url || '')}">
        <button type="button" class="toggle-qrcode-btn" title="添加二维码">二维码</button>
        <button type="button" class="remove-link-btn">删除</button>
        <div class="qrcode-section" style="display: none;">
          <input type="file" name="qrcode" accept="image/*" class="qrcode-input" style="display: none;">
          <button type="button" class="upload-qrcode-btn">上传二维码</button>
          <div class="qrcode-preview" style="display: none;">
            <img src="" alt="二维码预览">
            <button type="button" class="remove-qrcode-btn" title="移除二维码">✕</button>
          </div>
        </div>
      `;
      
      // 存储已有的QR码路径，并自动展开
      if (link.qrcode) {
        // 只有在还没有上传新QR码时才使用旧的
        if (!linkItem.dataset.qrcodePath) {
          linkItem.dataset.qrcodePath = link.qrcode;
        }
        
        // 显示已有的二维码预览，并自动展开QR码部分
        const qrcodeSection = linkItem.querySelector('.qrcode-section');
        const qrcodePreview = linkItem.querySelector('.qrcode-preview');
        const qrcodeImg = qrcodePreview.querySelector('img');
        const uploadBtn = linkItem.querySelector('.upload-qrcode-btn');
        const toggleBtn = linkItem.querySelector('.toggle-qrcode-btn');
        
        // 使用dataset中的路径（优先使用新上传的），否则使用旧的
        const qrcodePath = linkItem.dataset.qrcodePath || link.qrcode;
        qrcodeImg.src = `/assets/qrcodes/${qrcodePath.split('/').pop()}`; // 提取文件名
        qrcodePreview.style.display = 'flex';
        uploadBtn.style.display = 'none';
        
        // 自动展开QR码部分
        qrcodeSection.style.display = 'block';
        toggleBtn.classList.add('active');
        
        // 禁用URL输入框
        const urlInput = linkItem.querySelector('.link-url-input');
        urlInput.disabled = true;
      }
      
      const removeBtn = linkItem.querySelector('.remove-link-btn');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        linkItem.remove();
        updateRemoveButtonsInContainer(editLinksContainer);
      });
      
      // 附加QR码处理器
      attachQrcodeHandlersToItem(linkItem);
      
      editLinksContainer.appendChild(linkItem);
    });
  } else {
    // 添加一个空的链接项
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    linkItem.innerHTML = `
      <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)">
      <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com">
      <button type="button" class="toggle-qrcode-btn" title="添加二维码">二维码</button>
      <button type="button" class="remove-link-btn">删除</button>
      <div class="qrcode-section" style="display: none;">
        <input type="file" name="qrcode" accept="image/*" class="qrcode-input" style="display: none;">
        <button type="button" class="upload-qrcode-btn">上传二维码</button>
        <div class="qrcode-preview" style="display: none;">
          <img src="" alt="二维码预览">
          <button type="button" class="remove-qrcode-btn" title="移除二维码">✕</button>
        </div>
      </div>
    `;
    
    const removeBtn = linkItem.querySelector('.remove-link-btn');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      linkItem.remove();
      updateRemoveButtonsInContainer(editLinksContainer);
    });
    
    // 附加QR码处理器
    attachQrcodeHandlersToItem(linkItem);
    
    editLinksContainer.appendChild(linkItem);
  }
  
  updateRemoveButtonsInContainer(editLinksContainer);
  
  // 绑定"添加链接"按钮
  const addEditLinkBtn = document.getElementById('addEditLinkBtn');
  if (addEditLinkBtn) {
    addEditLinkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      addLinkToContainer(editLinksContainer);
    });
  }
}

// Get display name for field
function getFieldDisplayName(field) {
  const names = {
    location: '编辑所在地区',
    coordinates: '编辑坐标信息',
    shortDescription: '编辑社团简介（短）',
    longDescription: '编辑社团简介（长）',
    tags: '编辑标签',
    externalLinks: '编辑外部链接',
    logo: '编辑社团Logo'
  };
  return names[field] || '编辑信息';
}

// Generate edit form HTML for a field
function generateEditForm(field) {
  const currentValue = getCurrentFieldValue(field);
  
  switch (field) {
    case 'location':
      const [city, province] = parseLocation(currentValue);
      return `
        <label class="form-field">
          <span>所在省份 <strong class="required">*</strong></span>
          <select id="editProvince" required>
            <option value="">请选择省份</option>
            ${PROVINCES.map(p => `<option value="${p}" ${p === province ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </label>
        <label class="form-field">
          <span>所在城市</span>
          <input type="text" id="editCity" value="${city}" maxlength="50">
        </label>
      `;
    
    case 'coordinates':
      const [lat, lng] = parseCoordinates(currentValue);
      return `
        <fieldset class="form-field coordinates-field">
          <legend>坐标信息 <strong class="required">*</strong></legend>
          <div class="coordinates-inputs">
            <label>
              <span>纬度</span>
              <input type="number" id="editLatitude" value="${lat}" step="0.000001" min="-90" max="90" required>
            </label>
            <label>
              <span>经度</span>
              <input type="number" id="editLongitude" value="${lng}" step="0.000001" min="-180" max="180" required>
            </label>
          </div>
          <p class="helper-text">提示：建议尽量精确，可以通过其他地图软件获取</p>
        </fieldset>
      `;
    
    case 'shortDescription':
      return `
        <label class="form-field">
          <span>社团简介（短）</span>
          <textarea id="editShortDescription" rows="2" maxlength="200">${currentValue}</textarea>
        </label>
      `;
    
    case 'longDescription':
      return `
        <label class="form-field">
          <span>社团简介（长）</span>
          <textarea id="editLongDescription" rows="6" maxlength="1000">${currentValue}</textarea>
        </label>
      `;
    
    case 'tags':
      return `
        <label class="form-field">
          <span>标签（使用逗号分隔，最多 10 个）</span>
          <input type="text" id="editTags" value="${currentValue}">
        </label>
      `;
    
    case 'externalLinks':
      // External links are handled via the dynamic form, not inline edit
      return `
        <div class="form-field">
          <span>外部链接</span>
          <div id="editLinksContainer" class="links-container"></div>
          <button type="button" id="addEditLinkBtn" class="add-link-btn">+ 添加链接</button>
        </div>
      `;
    
    case 'logo':
      return `
        <label class="form-field">
          <span>社团 Logo（PNG/JPG/GIF/SVG，最大 20MB）</span>
          <input type="file" id="editLogo" accept=".png,.jpg,.jpeg,.gif,.svg">
        </label>
      `;
    
    default:
      return '<p>不支持的字段类型</p>';
  }
}

// Helper functions for parsing values
function getCurrentFieldValue(field) {
  if (!selectedClub) return '';
  
  switch (field) {
    case 'name': 
      return formData.get('name') || selectedClub.name || '';
    case 'school': 
      return formData.get('school') || selectedClub.school || '';
    case 'location': 
      if (formData.has('city') || formData.has('province')) {
        const city = formData.get('city') || selectedClub.city || '';
        const province = formData.get('province') || selectedClub.province || '';
        return city ? `${city}, ${province}` : province;
      }
      return selectedClub.city ? `${selectedClub.city}, ${selectedClub.province}` : selectedClub.province || '';
    case 'coordinates': 
      // First check if user has edited coordinates
      if (formData.has('latitude') && formData.has('longitude')) {
        const lat = formData.get('latitude');
        const lng = formData.get('longitude');
        return `${lat}, ${lng}`;
      }
      // Otherwise use original coordinates
      if (selectedClub.coordinates && Array.isArray(selectedClub.coordinates)) {
        return `${selectedClub.coordinates[1]}, ${selectedClub.coordinates[0]}`;
      } else if (selectedClub.latitude && selectedClub.longitude) {
        return `${selectedClub.latitude}, ${selectedClub.longitude}`;
      }
      return '';
    case 'shortDescription': 
      return formData.get('shortDescription') || selectedClub.shortDescription || '';
    case 'longDescription': 
      return formData.get('description') || selectedClub.description || '';
    case 'tags': 
      if (formData.has('tags')) {
        try {
          const tagsArray = JSON.parse(formData.get('tags'));
          return Array.isArray(tagsArray) ? tagsArray.join(', ') : formData.get('tags');
        } catch (e) {
          return formData.get('tags');
        }
      }
      return selectedClub.tags && selectedClub.tags.length > 0 ? selectedClub.tags.join(', ') : '';
    case 'externalLinks': 
      if (formData.has('externalLinks')) {
        try {
          return JSON.parse(formData.get('externalLinks')) || [];
        } catch (e) {
          return [];
        }
      }
      return selectedClub.externalLinks || [];
    case 'logo': return selectedClub.logo || '';
    default: return '';
  }
}

function parseLocation(locationStr) {
  if (!locationStr || locationStr === '-') return ['', ''];
  const parts = locationStr.split(', ');
  return [parts[0] || '', parts[1] || ''];
}

function parseCoordinates(coordStr) {
  if (!coordStr || coordStr === '-') return ['', ''];
  const parts = coordStr.split(', ');
  return [parts[0] || '', parts[1] || ''];
}

// Handle cancel edit
cancelEdit.addEventListener('click', () => {
  editForm.style.display = 'none';
  currentEditingField = null;
});

// Handle save edit
saveEdit.addEventListener('click', async () => {
  if (!currentEditingField) return;
  
  try {
    const newValue = getEditedValue(currentEditingField);
    if (!validateEditedValue(currentEditingField, newValue)) return;
    
    // Update the form data
    updateFormData(currentEditingField, newValue);
    
    // Update the display
    updateDisplayValue(currentEditingField, newValue);
    
    // Hide edit form
    editForm.style.display = 'none';
    currentEditingField = null;
    
    // Show confirm edit actions if we have changes
    updateConfirmEditVisibility();
    
    // Show success message
    showStatus('修改已保存，请点击"确认修改"提交更改', 'success');
    
  } catch (error) {
    console.error('保存编辑失败:', error);
    showStatus('保存失败，请重试', 'error');
  }
});

// Handle confirm field edit (same as save but keeps form open)
confirmFieldEdit.addEventListener('click', async () => {
  if (!currentEditingField) return;
  
  try {
    const newValue = getEditedValue(currentEditingField);
    if (!validateEditedValue(currentEditingField, newValue)) return;
    
    // Update the form data
    updateFormData(currentEditingField, newValue);
    
    // Update the display
    updateDisplayValue(currentEditingField, newValue);
    
    // Hide edit form
    editForm.style.display = 'none';
    currentEditingField = null;
    
    // Show confirm edit actions if we have changes
    updateConfirmEditVisibility();
    
    // Show success message
    showStatus('修改已确认，可以继续编辑其他字段或提交更改', 'success');
    
  } catch (error) {
    console.error('确认编辑失败:', error);
    showStatus('确认失败，请重试', 'error');
  }
});

// Get edited value from form inputs
function getEditedValue(field) {
  switch (field) {
    case 'name':
      return document.getElementById('editName').value.trim();
    
    case 'school':
      return document.getElementById('editSchool').value.trim();
    
    case 'location':
      const province = document.getElementById('editProvince').value;
      const city = document.getElementById('editCity').value.trim();
      return city ? `${city}, ${province}` : province;
    
    case 'coordinates':
      const lat = document.getElementById('editLatitude').value;
      const lng = document.getElementById('editLongitude').value;
      return `${lat}, ${lng}`;
    
    case 'shortDescription':
      return document.getElementById('editShortDescription').value.trim();
    
    case 'longDescription':
      return document.getElementById('editLongDescription').value.trim();
    
    case 'tags':
      return document.getElementById('editTags').value.trim();
    
    case 'externalLinks':
      // 使用统一的collectLinks函数收集外部链接（包括QR码）
      const editLinksContainer = document.getElementById('editLinksContainer');
      if (!editLinksContainer) return [];
      return collectLinks(editLinksContainer);
    
    case 'logo':
      return document.getElementById('editLogo').files[0];
    
    default:
      return '';
  }
}

// Validate edited value
function validateEditedValue(field, value) {
  switch (field) {
    case 'name':
    case 'school':
      if (!value) {
        showMessage('此字段不能为空', 'error');
        return false;
      }
      break;
    
    case 'location':
      if (!value) {
        showMessage('省份不能为空', 'error');
        return false;
      }
      break;
    
    case 'coordinates':
      const [lat, lng] = value.split(', ');
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        showMessage('坐标格式不正确', 'error');
        return false;
      }
      break;
    
    case 'logo':
      if (value && !validateLogoFile(value)) {
        return false;
      }
      break;
  }
}

// Update form data
function updateFormData(field, value) {
  switch (field) {
    case 'name':
      formData.set('name', value);
      break;
    
    case 'school':
      formData.set('school', value);
      break;
    
    case 'location':
      const [city, province] = parseLocation(value);
      formData.set('province', province);
      formData.set('city', city);
      break;
    
    case 'coordinates':
      const [lat, lng] = value.split(', ');
      formData.set('latitude', lat);
      formData.set('longitude', lng);
      break;
    
    case 'shortDescription':
      formData.set('shortDescription', value);
      break;
    
    case 'longDescription':
      formData.set('description', value);
      break;
    
    case 'tags':
      const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
      formData.set('tags', JSON.stringify(tags));
      break;
    
    case 'externalLinks':
      formData.set('externalLinks', JSON.stringify(value || []));
      break;
    
    case 'logo':
      if (value) {
        formData.set('logo', value);
      }
      break;
  }
}

// Update display value
function updateDisplayValue(field, value) {
  switch (field) {
    case 'name':
      displayElements.name.textContent = value || '-';
      break;
    
    case 'school':
      displayElements.school.textContent = value || '-';
      break;
    
    case 'location':
      displayElements.location.textContent = value || '-';
      break;
    
    case 'coordinates':
      displayElements.coordinates.textContent = value || '-';
      break;
    
    case 'shortDescription':
      displayElements.shortDescription.textContent = value || '-';
      break;
    
    case 'longDescription':
      displayElements.longDescription.textContent = value || '-';
      break;
    
    case 'tags':
      displayElements.tags.textContent = value || '-';
      break;
    
    case 'externalLinks':
      displayElements.externalLinks.textContent = formatExternalLinksDisplay(value) || '-';
      break;
    
    case 'logo':
      if (value) {
        // For logo, we'll need to upload and get the new URL
        // This will be handled when the form is submitted
        displayElements.logo.src = URL.createObjectURL(value);
        displayElements.logo.style.display = 'block';
        displayElements.logoPlaceholder.style.display = 'none';
      }
      break;
  }
}

// Format external links for display
function formatExternalLinksDisplay(links) {
  if (!Array.isArray(links) || links.length === 0) {
    return '-';
  }
  return links.map(link => `${link.type}: ${link.url}`).join(' | ');
}

// Initialize remove button visibility
updateRemoveButtonVisibility();

populateProvinces();

// Handle confirm edit submission
confirmEdit.addEventListener('click', async () => {
  if (!selectedClub || !formData.size) {
    showStatus('没有修改内容', 'error');
    return;
  }

  // Validate email
  const submitterEmail = editSubmitterEmail.value.trim();
  if (!submitterEmail) {
    showStatus('请输入邮箱地址', 'error');
    editSubmitterEmail.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    showStatus('请输入有效的邮箱地址', 'error');
    editSubmitterEmail.focus();
    return;
  }

  try {
    // Show loading state
    confirmEdit.disabled = true;
    confirmEdit.textContent = '提交中...';

    // Handle logo upload first if changed
    let logoPath = selectedClub.logo || selectedClub.logo || '';
    if (formData.has('logo')) {
      const logoFile = formData.get('logo');
      if (logoFile instanceof File) {
        const uploadedPath = await uploadLogo(logoFile);
        if (uploadedPath) {
          logoPath = uploadedPath;
        }
      }
    }

    // 开始收集调试信息并收集外部链接（编辑模式）
    startDebugReport();
    const editLinksContainer = document.getElementById('editLinksContainer');
    const externalLinks = editLinksContainer ? collectLinks(editLinksContainer) : [];

    // Build submission data with correct field names
    // Start with the base structure that matches validation schema
    let submissionData = {
      submissionType: 'edit',
      editingClubId: `${selectedClub.name}|${selectedClub.school}`,
      submitterEmail: submitterEmail,
      // Initialize with current selected club data as defaults
      name: selectedClub.name,
      school: selectedClub.school,
      province: selectedClub.province,
      city: selectedClub.city,
      coordinates: {
        latitude: selectedClub.coordinates?.[1] || selectedClub.latitude || 0,
        longitude: selectedClub.coordinates?.[0] || selectedClub.longitude || 0
      },
      shortDescription: selectedClub.shortDescription || selectedClub.shortDescription || '',
      description: selectedClub.description || selectedClub.description || '',
      tags: selectedClub.tags || [],
      logo: logoPath,
      externalLinks: externalLinks
    };

    // Apply edited fields with correct field name mappings
    for (const [field, value] of formData) {
      if (field === 'logo') continue; // Already handled above
      
      switch (field) {
        case 'name':
          submissionData.name = value;
          break;
        case 'school':
          submissionData.school = value;
          break;
        case 'province':
          submissionData.province = value;
          break;
        case 'city':
          submissionData.city = value;
          break;
        case 'latitude':
          submissionData.coordinates.latitude = parseFloat(value);
          break;
        case 'longitude':
          submissionData.coordinates.longitude = parseFloat(value);
          break;
        case 'coordinates':
          const [lat, lng] = value.split(', ');
          submissionData.coordinates = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng)
          };
          break;
        case 'shortDescription':
          submissionData.shortDescription = value;
          break;
        case 'description':
          submissionData.description = value;
          break;
        case 'tags':
          // Handle tags - could be either JSON array string or comma-separated string
          let tagsArray;
          try {
            // Try to parse as JSON first
            tagsArray = JSON.parse(value);
            if (!Array.isArray(tagsArray)) {
              tagsArray = [value];
            }
          } catch (e) {
            // If not JSON, treat as comma-separated string
            tagsArray = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
          }
          submissionData.tags = tagsArray;
          break;
      }
    }

    // 输出本次编辑提交的调试信息（包含链接处理过程和最终 payload）
    // 此时 submissionData 已包含所有编辑修改
    flushDebug(submissionData);

    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submissionData)
    });

    // 调试信息已通过 flushDebug 在发送前一次性输出

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      // 提供更详细的错误信息
      let errorMessage = result?.message || '修改失败，请稍后再试';
      
      if (response.status === 503 || result?.error === 'SERVICE_UNAVAILABLE') {
        errorMessage = '数据库连接暂时不可用，请稍后再试';
      } else if (response.status === 400 && result?.errors) {
        errorMessage = `验证失败：${result.errors.map(e => e.message).join(', ')}`;
      }
      
      console.error('Submission failed:', {
        status: response.status,
        error: result?.error,
        message: result?.message,
        errors: result?.errors
      });
      
      throw new Error(errorMessage);
    }

    // Success
    showStatus('修改已提交，等待管理员审核', 'success');
    
    // Reset edit state
    formData.clear();
    updateConfirmEditVisibility();
    editModeInterface.style.display = 'none';
    clubSearchSection.style.display = 'none';
    toggleEditMode.classList.remove('active');
    currentMode = 'new';
    selectedClub = null;

  } catch (error) {
    console.error('提交编辑失败:', error);
    showStatus(error.message || '提交失败，请重试', 'error');
  } finally {
    // Reset button state
    confirmEdit.disabled = false;
    confirmEdit.textContent = '确认修改';
  }
});

// Handle cancel all edits
cancelAllEdits.addEventListener('click', () => {
  if (confirm('确定要取消所有修改吗？')) {
    // Reset form data
    formData.clear();
    
    // Reload original club data
    if (selectedClub) {
      populateEditInterface(selectedClub);
    }
    
    // Hide confirm actions
    updateConfirmEditVisibility();
    
    showStatus('已取消所有修改', 'success');
  }
});
