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
 * Collect contact data object, removing empty values.
 */
function collectContact() {
  const contact = {};

  const email = contactEmailInput.value.trim();
  const qq = contactQQInput.value.trim();
  const wechat = contactWechatInput.value.trim();

  if (email) {
    contact.email = email;
  }
  if (qq) {
    contact.qq = qq;
  }
  if (wechat) {
    contact.wechat = wechat;
  }

  return contact;
}

/**
 * Collect links from the dynamic links container.
 */
function collectLinks() {
  const linkItems = linksContainer.querySelectorAll('.link-item');
  const links = [];

  linkItems.forEach(item => {
    const typeInput = item.querySelector('.link-type-input') || item.querySelector('.link-type-select');
    const type = typeInput.value.trim();
    const url = item.querySelector('.link-url-input').value.trim();

    if (type && url) {
      links.push({ type, url });
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
    const latitude = parseFloat(latitudeInput.value.trim());
    const longitude = parseFloat(longitudeInput.value.trim());
    validateCoordinates(latitude, longitude);

    const tags = parseTags(tagsInput.value);
    const links = collectLinks();

    const payload = {
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

    const logoFile = logoInput.files?.[0];
    if (logoFile) {
      const logoPath = await uploadLogo(logoFile);
      payload.logo = logoPath;
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
      if (result?.errors?.length) {
        const details = result.errors.map(err => `• ${err.message}`).join('\n');
        throw new Error(`${result.message || '提交失败'}\n${details}`);
      }
      throw new Error(result?.message || '提交失败，请稍后再试');
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

// Set up event listeners for initial remove buttons
const initialRemoveButtons = linksContainer.querySelectorAll('.remove-link-btn');
initialRemoveButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    btn.parentElement.remove();
    updateRemoveButtonVisibility();
  });
});

// Initialize remove button visibility
updateRemoveButtonVisibility();

populateProvinces();
