const PROVINCES = [
  '北京市', '天津市', '上海市', '重庆市',
  '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
  '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '海南省',
  '四川省', '贵州省', '云南省', '陕西省', '甘肃省',
  '青海省', '台湾省',
  '内蒙古自治区', '广西壮族自治区', '西藏自治区',
  '宁夏回族自治区', '新疆维吾尔自治区',
  '香港特别行政区', '澳门特别行政区'
];

/**
 * HTML属性转义函数，防止XSS
 */
function escapeHtmlAttr(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
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
 * Parse tags from user input.
 * @param {string} raw
 * @returns {string[]}
 */
function parseTags(raw) {
  if (!raw) {
    return [];
  }

  const tags = raw
    .split(/[,，\n]/)
    .map(tag => tag.trim())
    .filter(Boolean);

  if (tags.length > 10) {
    throw new Error('标签数量最多 10 个，请删除多余的标签');
  }

  return tags;
}

/**
 * Validate latitude/longitude range.
 */
function validateCoordinates(lat, lng) {
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error('请填写有效的经纬度坐标');
  }
  if (lat < -90 || lat > 90) {
    throw new Error('纬度必须在 -90 到 90 之间');
  }
  if (lng < -180 || lng > 180) {
    throw new Error('经度必须在 -180 到 180 之间');
  }
}

/**
 * Upload logo if present.
 * @param {File|undefined} file
 * @returns {Promise<string>}
 */
async function uploadLogo(file) {
  if (!file) {
    return '';
  }

  const formData = new FormData();
  formData.append('logo', file);

  const response = await fetch('/api/upload/logo', {
    method: 'POST',
    body: formData
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Logo 上传失败，请稍后再试');
  }

  return result.data.path;
}

/**
 * Collect links from the dynamic links container.
 */
function collectLinks() {
  const linkItems = linksContainer.querySelectorAll('.link-item');
  const links = [];

  linkItems.forEach(item => {
    // 尝试多种选择器以支持不同的标签方式
    const typeInput = item.querySelector('.link-type-input') || 
                      item.querySelector('[name="linkType"]') || 
                      item.querySelector('.link-type');
    
    const urlInput = item.querySelector('.link-url-input') || 
                     item.querySelector('[name="linkUrl"]') || 
                     item.querySelector('.link-url');
    
    // 安全检查：确保两个输入都存在且有值
    if (typeInput && urlInput) {
      try {
        const type = (typeInput.value || '').trim();
        const url = (urlInput.value || '').trim();

        // 只有当两个字段都有值时才添加
        if (type && url) {
          links.push({ type, url });
        }
      } catch (error) {
        console.warn('链接收集错误:', error, item);
        // 继续处理其他链接
      }
    }
  });

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
    <button type="button" class="remove-link-btn">删除</button>
  `;

  const removeBtn = linkItem.querySelector('.remove-link-btn');
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    linkItem.remove();
    updateRemoveButtonVisibility();
  });

  linksContainer.appendChild(linkItem);
  updateRemoveButtonVisibility();
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
  linksContainer.innerHTML = `
    <div class="link-item">
      <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (如: 网站, GitHub, 微博等)">
      <input type="url" name="linkUrl" class="link-url-input" placeholder="输入链接地址或ID">
      <button type="button" class="remove-link-btn" style="display: none;">删除</button>
    </div>
  `;
  updateRemoveButtonVisibility();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearStatus();

  if (!form.reportValidity()) {
    showStatus('请检查必填项是否填写完整', 'error');
    return;
  }

  toggleLoading(true);

  try {
    // Use formData values if in edit mode, otherwise use form inputs
    let latitude, longitude, tags, links, payload;
    
    if (currentMode === 'edit') {
      latitude = parseFloat(formData.get('latitude') || '0');
      longitude = parseFloat(formData.get('longitude') || '0');
      validateCoordinates(latitude, longitude);
      tags = JSON.parse(formData.get('tags') || '[]');
      links = collectLinks(); // Links are still collected from the form
      
      payload = {
        submissionType: currentMode,
        name: formData.get('name') || '',
        school: formData.get('school') || '',
        province: formData.get('province') || '',
        city: formData.get('city') || '',
        coordinates: {
          latitude,
          longitude
        },
        short_description: formData.get('short_description') || '',
        long_description: formData.get('long_description') || '',
        tags,
        external_links: links,
        submitterEmail: document.getElementById('submitterEmail').value.trim()
      };

      // Add editing club ID if in edit mode
      if (selectedClub) {
        payload.editingClubId = selectedClub.id;
      }
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
        short_description: shortDescriptionInput.value.trim(),
        long_description: longDescriptionInput.value.trim(),
        tags,
        external_links: links,
        submitterEmail: document.getElementById('submitterEmail').value.trim()
      };
    }

    const logoFile = logoInput.files?.[0];
    if (logoFile) {
      const logoPath = await uploadLogo(logoFile);
      payload.logo = logoPath;
    } else if (currentMode === 'edit' && formData.get('logo')) {
      payload.logo = formData.get('logo');
    }

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
    <button type="button" class="remove-link-btn">删除</button>
  `;

  const removeBtn = linkItem.querySelector('.remove-link-btn');
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    linkItem.remove();
    // 更新容器中的删除按钮可见性
    updateRemoveButtonsInContainer(container);
  });

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
  formData.set('coordinates', club.latitude && club.longitude ? `${club.latitude}, ${club.longitude}` : '');
  formData.set('shortDescription', club.short_description || '');
  formData.set('longDescription', club.long_description || '');
  formData.set('tags', club.tags && club.tags.length > 0 ? club.tags.join(', ') : '');
  formData.set('logo', club.img_name || '');

  // Set logo
  if (club.img_name) {
    displayElements.logo.src = `/assets/compressedLogos/${club.img_name}`;
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
  displayElements.coordinates.textContent = club.latitude && club.longitude ? 
    `${club.latitude}, ${club.longitude}` : '-';
  displayElements.shortDescription.textContent = club.short_description || '-';
  displayElements.longDescription.textContent = club.long_description || '-';
  displayElements.tags.textContent = club.tags && club.tags.length > 0 ? club.tags.join(', ') : '-';
  
  // Display external links
  if (club.external_links && club.external_links.length > 0) {
    displayElements.externalLinks.textContent = club.external_links
      .map(link => `${link.type}`)
      .join(' | ');
  } else {
    displayElements.externalLinks.textContent = '-';
  }

  // Populate external links form from club data
  // Clear existing links first
  linksContainer.innerHTML = '';
  
  // Add links from club data
  if (club.external_links && club.external_links.length > 0) {
    club.external_links.forEach(link => {
      const linkItem = document.createElement('div');
      linkItem.className = 'link-item';
      linkItem.innerHTML = `
        <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)" value="${escapeHtmlAttr(link.type || '')}">
        <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com" value="${escapeHtmlAttr(link.url || '')}">
        <button type="button" class="remove-link-btn" style="padding: 5px 10px;">删除</button>
      `;
      
      // Add remove button listener
      const removeBtn = linkItem.querySelector('.remove-link-btn');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleRemoveLinkClick(e);
      });
      
      linksContainer.appendChild(linkItem);
    });
  } else {
    // Add one empty link item if no links exist
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    linkItem.innerHTML = `
      <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)">
      <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com">
      <button type="button" class="remove-link-btn" style="padding: 5px 10px;">删除</button>
    `;
    
    const removeBtn = linkItem.querySelector('.remove-link-btn');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleRemoveLinkClick(e);
    });
    
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
  currentEditingField = field;
  editFormTitle.textContent = getFieldDisplayName(field);
  editFormContent.innerHTML = generateEditForm(field);
  editForm.style.display = 'block';
  
  // 如果是编辑外链，需要加载现有的链接数据
  if (field === 'external_links') {
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
  
  if (selectedClub && selectedClub.external_links && selectedClub.external_links.length > 0) {
    selectedClub.external_links.forEach(link => {
      const linkItem = document.createElement('div');
      linkItem.className = 'link-item';
      linkItem.innerHTML = `
        <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)" value="${escapeHtmlAttr(link.type || '')}">
        <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com" value="${escapeHtmlAttr(link.url || '')}">
        <button type="button" class="remove-link-btn">删除</button>
      `;
      
      const removeBtn = linkItem.querySelector('.remove-link-btn');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        linkItem.remove();
        updateRemoveButtonsInContainer(editLinksContainer);
      });
      
      editLinksContainer.appendChild(linkItem);
    });
  } else {
    // 添加一个空的链接项
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    linkItem.innerHTML = `
      <input type="text" name="linkType" class="link-type-input" placeholder="链接类型 (例: 官网、微博)">
      <input type="url" name="linkUrl" class="link-url-input" placeholder="https://example.com">
      <button type="button" class="remove-link-btn">删除</button>
    `;
    
    const removeBtn = linkItem.querySelector('.remove-link-btn');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      linkItem.remove();
      updateRemoveButtonsInContainer(editLinksContainer);
    });
    
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
    name: '编辑社团名称',
    school: '编辑所属学校',
    location: '编辑所在地区',
    coordinates: '编辑坐标信息',
    shortDescription: '编辑社团简介（短）',
    longDescription: '编辑社团简介（长）',
    tags: '编辑标签',
    external_links: '编辑外部链接',
    logo: '编辑社团Logo'
  };
  return names[field] || '编辑信息';
}

// Generate edit form HTML for a field
function generateEditForm(field) {
  const currentValue = getCurrentFieldValue(field);
  
  switch (field) {
    case 'name':
      return `
        <label class="form-field">
          <span>社团名称 <strong class="required">*</strong></span>
          <input type="text" id="editName" value="${currentValue}" required maxlength="100">
        </label>
      `;
    
    case 'school':
      return `
        <label class="form-field">
          <span>所属学校 <strong class="required">*</strong></span>
          <input type="text" id="editSchool" value="${currentValue}" required maxlength="200">
        </label>
      `;
    
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
    
    case 'external_links':
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
    case 'name': return selectedClub.name || '';
    case 'school': return selectedClub.school || '';
    case 'location': return selectedClub.city ? `${selectedClub.city}, ${selectedClub.province}` : selectedClub.province || '';
    case 'coordinates': return selectedClub.latitude && selectedClub.longitude ? `${selectedClub.latitude}, ${selectedClub.longitude}` : '';
    case 'shortDescription': return selectedClub.short_description || '';
    case 'longDescription': return selectedClub.long_description || '';
    case 'tags': return selectedClub.tags && selectedClub.tags.length > 0 ? selectedClub.tags.join(', ') : '';
    case 'external_links': return selectedClub.external_links || [];
    case 'logo': return selectedClub.img_name || '';
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
    
    case 'external_links':
      // Collect external links from the edit form
      const editLinksContainer = document.getElementById('editLinksContainer');
      if (!editLinksContainer) return [];
      const linkItems = editLinksContainer.querySelectorAll('.link-item');
      const links = [];
      linkItems.forEach(item => {
        const typeInput = item.querySelector('.link-type-input') || item.querySelector('.link-type');
        const urlInput = item.querySelector('.link-url-input') || item.querySelector('.link-url');
        const type = typeInput?.value.trim();
        const url = urlInput?.value.trim();
        if (type && url) {
          links.push({ type, url });
        }
      });
      return links;
    
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
  
  return true;
}

// Validate logo file
function validateLogoFile(file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
  const maxSize = 20 * 1024 * 1024; // 20MB
  
  if (!allowedTypes.includes(file.type)) {
    showMessage('Logo 文件格式不正确，请使用 PNG、JPG、GIF 或 SVG 格式', 'error');
    return false;
  }
  
  if (file.size > maxSize) {
    showMessage('Logo 文件大小不能超过 20MB', 'error');
    return false;
  }
  
  return true;
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
      formData.set('short_description', value);
      break;
    
    case 'longDescription':
      formData.set('long_description', value);
      break;
    
    case 'tags':
      const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
      formData.set('tags', JSON.stringify(tags));
      break;
    
    case 'external_links':
      formData.set('external_links', JSON.stringify(value || []));
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
    
    case 'external_links':
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
    let logoPath = selectedClub.img_name || '';
    if (formData.has('logo')) {
      const logoFile = formData.get('logo');
      if (logoFile instanceof File) {
        const uploadedPath = await uploadLogo(logoFile);
        if (uploadedPath) {
          logoPath = uploadedPath;
        }
      }
    }

    // Collect external links from the form (same as new submission mode)
    const externalLinks = collectLinks();

    // Build submission data with correct field names
    // Start with the base structure that matches validation schema
    let submissionData = {
      submissionType: 'edit',
      editingClubId: selectedClub.id,
      submitterEmail: submitterEmail,
      // Initialize with current selected club data as defaults
      name: selectedClub.name,
      school: selectedClub.school,
      province: selectedClub.province,
      city: selectedClub.city,
      coordinates: {
        latitude: selectedClub.latitude,
        longitude: selectedClub.longitude
      },
      short_description: selectedClub.short_description || '',
      long_description: selectedClub.long_description || '',
      tags: selectedClub.tags || [],
      logo: logoPath,
      external_links: externalLinks
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
        case 'location':
          const [city, province] = value.split(', ');
          submissionData.province = province;
          if (city) submissionData.city = city;
          break;
        case 'coordinates':
          const [lat, lng] = value.split(', ');
          submissionData.coordinates = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng)
          };
          break;
        case 'shortDescription':
          submissionData.short_description = value;
          break;
        case 'longDescription':
          submissionData.long_description = value;
          break;
        case 'tags':
          submissionData.tags = parseTags(value);
          break;
      }
    }

    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submissionData)
    });

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
