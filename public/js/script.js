/**
 * 首页地图展示脚本 (index.html)
 * 
 * 核心功能：
 *   - 高德地图初始化与社团标记点显示
 *   - 社团数据加载（API 或 JSON 备用）
 *   - 社团详情卡片展示（含外部链接和二维码）
 *   - 搜索功能（按名称/学校/标签）
 *   - 省份过滤与社团列表展示
 *   - 二维码弹窗展示
 * 
 * 依赖：config.js (MAP_CONFIG), AMap (高德地图 API)
 * 被依赖：index.html
 *
 * 注：escapeHtml, isValidUrl, getLinkTypeIcon 是首页专用函数，
 * 不复用 utils.js，以保持代码独立性和页面加载性能
 */

let map;
let markers = [];
let clubsData = [];
let currentProvinceFilter = null; // 当前选中的省份过滤器

/**
 * 转义HTML特殊字符，防止XSS攻击
 * 用于将用户数据安全地渲染到 DOM 中
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * 根据链接类型返回对应的图标
 * 为不同平台的社团外部链接提供 Emoji 图标表示
 */
function getLinkTypeIcon(type) {
    const typeMap = {
        '官网': '🌐',
        '网站': '🌐',
        'Website': '🌐',
        'GitHub': '💻',
        'github': '💻',
        '微博': '📱',
        'Weibo': '📱',
        '抖音': '🎵',
        'Douyin': '🎵',
        'TikTok': '🎵',
        '快手': '🎥',
        'Kuaishou': '🎥',
        'B站': '▶️',
        'BiliBili': '▶️',
        'bilibili': '▶️',
        '小红书': '❤️',
        'RED': '❤️',
        'WeChat': '💬',
        '微信': '💬',
        'QQ': '💬',
        'Email': '✉️',
        '邮箱': '✉️',
        'Twitter': '𝕏',
        'X': '𝕏',
        'Facebook': '👍',
        'Instagram': '📷',
        'LinkedIn': '💼',
        'YouTube': '🎬',
        'Discord': '💜'
    };
    return typeMap[type] || '🔗';
}

/**
 * 判断字符串是否为有效的 URL
 * 用于社团详情中区分是否显示可点击链接或纯文本
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 根据环境获取资源路径
 * 本地开发使用相对路径，生产环境使用绝对路径，便于跨域访问
 * @param {string} path - 资源路径
 * @returns {string} 处理后的资源路径
 */
function getResourcePath(path) {
    // 如果是本地开发（localhost 或 127.0.0.1），用相对路径
    const isLocalDev = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168') ||
                       window.location.hostname.startsWith('[::');
    
    if (isLocalDev) {
        return path.startsWith('/') ? '.' + path : path;
    } else {
        return path.startsWith('/') ? path : '/' + path;
    }
}

/**
 * 获取 API 路径 - API 路径始终从根路径开始
 * @param {string} path - API 路径
 * @returns {string} 处理后的 API 路径
 */
function getApiPath(path) {
    // API路径始终从根路径开始
    return path.startsWith('/') ? path : '/' + path;
}

/**
 * 初始化并适配地图配置
 * 将 config.js 中的 MAP_CONFIG 转换为环境相适应的资源路径格式
 * @returns {object} 经过环境处理的配置对象
 */
function initMapConfig() {
    return {
        LOGO_DIR: getResourcePath(MAP_CONFIG.LOGO_DIR),
        FALLBACK_LOGO_DIR: getResourcePath(MAP_CONFIG.FALLBACK_LOGO_DIR),
        DATA_PATH: getApiPath(MAP_CONFIG.DATA_PATH),
        DATA_PATH_FALLBACK: getResourcePath(MAP_CONFIG.DATA_PATH_FALLBACK),
        PLACEHOLDER: getResourcePath(MAP_CONFIG.PLACEHOLDER),
        DEFAULT_ZOOM: MAP_CONFIG.DEFAULT_ZOOM,
        CENTER: MAP_CONFIG.CENTER,
        DETAIL_ZOOM: MAP_CONFIG.DETAIL_ZOOM
    };
}

// 实例化配置 - 在脚本加载时立即计算
const CONFIG = initMapConfig();

/**
 * 解析 Logo 图片路径
 * @param {string} imgName - 图片文件名或完整路径
 * @returns {string} 完整的图片路径
 */
function resolveLogoPath(imgName) {
    if (!imgName || typeof imgName !== 'string' || imgName.trim() === '') {
        return CONFIG.PLACEHOLDER;
    }

    const trimmed = imgName.trim();

    // 如果是完整路径（以 / 开头），转换为文件名
    let filename = trimmed;
    if (trimmed.startsWith('/')) {
        filename = trimmed.split('/').pop(); // 提取文件名
    }

    // 优先尝试压缩版本（.png 格式）
    const baseFilename = filename.replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, '');
    const compressedPath = `${CONFIG.LOGO_DIR}${baseFilename}.png`;

    // 返回压缩路径
    return compressedPath;
}

function initMap() {
    try {
        map = new AMap.Map('map', {
            zoom: CONFIG.DEFAULT_ZOOM,
            center: CONFIG.CENTER,
            viewMode: '2D',
            lang: 'zh_cn'
        });
    } catch (error) {
        console.error('地图初始化失败:', error);
        alert('地图初始化失败，请检查网络连接。');
    }
}

async function loadData() {
    try {
        // 首先尝试从API加载
        let response = await fetch(CONFIG.DATA_PATH);

        if (!response.ok) {
            // 如果是服务不可用（503），也尝试备用文件
            if (response.status === 503) {
                console.warn('API temporarily unavailable (503), trying fallback...');
            } else {
                console.warn(`API failed with ${response.status}, trying fallback...`);
            }
            // 如果API失败，尝试静态文件
            response = await fetch(CONFIG.DATA_PATH_FALLBACK);
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // 处理API响应格式 {success: true, data: [...]}
        if (data.success && Array.isArray(data.data)) {
            clubsData = data.data;
        } else if (Array.isArray(data)) {
            // 静态JSON格式
            clubsData = data;
        } else {
            throw new Error('Invalid data format');
        }

        console.log(`✓ Loaded ${clubsData.length} clubs`);
        displayMarkers();
        createProvinceList();
    } catch (error) {
        console.error('数据加载失败:', error);
        // 不要显示alert，而是显示一个友好的错误信息
        showDataLoadError(error.message);
    }
}

function showDataLoadError(message) {
    // 在地图容器中显示错误信息
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'data-load-error';
        errorDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 300px;
            z-index: 1000;
        `;
        errorDiv.innerHTML = `
            <h3 style="color: #e74c3c; margin: 0 0 10px 0;">数据加载失败</h3>
            <p style="color: #666; margin: 0 0 15px 0; font-size: 14px;">${message}</p>
            <button onclick="location.reload()" style="
                background: #3498db;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            ">重试</button>
        `;
        mapContainer.appendChild(errorDiv);
    }
}

// 显示标记
function displayMarkers(provinceFilter = null) {
    // 清除现有标记
    markers.forEach(markerObj => {
        map.remove(markerObj.marker);
    });
    markers = [];

    clubsData.forEach(club => {
        // 支持两种坐标格式：coordinates数组 或 latitude/longitude字段
        const coordinates = club.coordinates || (club.latitude && club.longitude ? [club.longitude, club.latitude] : null);
        
        if (coordinates && coordinates.length >= 2) {
            // 如果有省份过滤器，检查是否匹配
            if (provinceFilter && provinceFilter !== 'all') {
                if (provinceFilter === '其他地区') {
                    // "其他地区"仅包括海外和没有省份信息的社团
                    if (club.province) {
                        return; // 跳过有省份信息的社团
                    }
                } else if (club.province !== provinceFilter) {
                    return; // 跳过不匹配的省份
                }
            }

            const logoUrl = resolveLogoPath(club.logo);

            // 创建高德地图自定义图标
            const icon = new AMap.Icon({
                image: logoUrl,
                size: new AMap.Size(60, 60),        // 图标显示大小
                imageSize: new AMap.Size(60, 60),   // 图片大小
                imageOffset: new AMap.Pixel(0, 0)   // 图片偏移
            });

            // 创建高德地图标记
            const marker = new AMap.Marker({
                position: [coordinates[0], coordinates[1]], // 高德地图是[经度,纬度]
                icon: icon,
                title: club.name,
                map: map,
                offset: new AMap.Pixel(-30, -60) // 偏移使图标底部对准坐标点
            });

            // 添加点击事件
            marker.on('click', () => {
                showClubDetails(club);
            });

            markers.push({ marker, club });
        }
    });
}

// 显示社团详情
function showClubDetails(club) {
    const detailsDiv = document.getElementById('clubDetails');
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    
    const template = document.getElementById('club-detail-template');
    const content = template.content.cloneNode(true);
    
    const logoImg = content.querySelector('.club-logo');
    logoImg.src = resolveLogoPath(club.logo);
    if (club.logo) {
        logoImg.style.display = 'block';
    } else {
        logoImg.style.display = 'none';
    }
    
    content.querySelector('.club-name').textContent = club.name;
    content.querySelector('.club-school').textContent = `${club.school} - ${club.city}, ${club.province}`;
    
    // 简介
    const descDiv = content.querySelector('.club-description');
    if (club.shortDescription || club.description) {
        descDiv.innerHTML = ''; // 清空内容
        
        if (club.shortDescription) {
            const blockquote = document.createElement('blockquote');
            blockquote.className = 'club-quote';
            blockquote.textContent = club.shortDescription;
            descDiv.appendChild(blockquote);
        }
        
        if (club.description) {
            if (club.shortDescription) {
                descDiv.appendChild(document.createElement('br'));
            }
            const paragraph = document.createElement('p');
            paragraph.textContent = club.description;
            paragraph.style.margin = '0';
            descDiv.appendChild(paragraph);
        }
    } else {
        descDiv.style.display = 'none';
    }
    
    // 标签
    const tagsDiv = content.querySelector('.club-tags');
    if (club.tags && club.tags.length > 0) {
        tagsDiv.innerHTML = '';
        club.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = tag;
            tagsDiv.appendChild(span);
        });
    } else {
        tagsDiv.style.display = 'none';
    }
    
    // 外部链接
    const linksDiv = content.querySelector('.club-links');
    linksDiv.innerHTML = '';
    const h3 = document.createElement('h3');
    h3.textContent = '外部链接';
    linksDiv.appendChild(h3);
    
    if (club.externalLinks && club.externalLinks.length > 0) {
        // 创建链接容器
        const linksContainer = document.createElement('div');
        linksContainer.className = 'external-links-container';
        
        let hasValidLinks = false;
        club.externalLinks.forEach((link, index) => {
            // 检查是否有有效的链接内容：URL 或 QR码
            if (link.type && (link.url || link.qrcode)) {
                hasValidLinks = true;
                const linkWrapper = document.createElement('div');
                linkWrapper.className = 'external-link-wrapper';
                
                // 只在有URL时显示链接
                if (link.url) {
                    if (isValidUrl(link.url)) {
                        // 如果是URL，显示链接样式和Type
                        const a = document.createElement('a');
                        a.href = link.url;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.className = 'external-link-item';
                        
                        const icon = getLinkTypeIcon(link.type);
                        a.innerHTML = `<span class="link-icon">${icon}</span><span class="link-text">${escapeHtml(link.type)}</span>`;
                        a.title = link.url;
                        
                        linkWrapper.appendChild(a);
                    } else {
                        // 如果不是URL，显示文本样式
                        const textDiv = document.createElement('div');
                        textDiv.className = 'external-link-item external-link-text';
                        
                        const icon = getLinkTypeIcon(link.type);
                        textDiv.innerHTML = `<span class="link-icon">${icon}</span><span class="link-text">${escapeHtml(link.type)}: ${escapeHtml(link.url)}</span>`;
                        
                        linkWrapper.appendChild(textDiv);
                    }
                }
                
                // Add QR code if available - 不显示Type，直接显示QR码
                if (link.qrcode) {
                    const qrcodeDiv = document.createElement('div');
                    qrcodeDiv.className = 'qrcode-display';
                    
                    const qrcodeImg = document.createElement('img');
                    qrcodeImg.src = `/assets/qrcodes/${link.qrcode}`;
                    qrcodeImg.alt = `${link.type} 二维码`;
                    qrcodeImg.className = 'qrcode-thumbnail';
                    qrcodeImg.title = '点击查看大图';
                    
                    // Click to show full size
                    qrcodeImg.onclick = (e) => {
                        e.stopPropagation();
                        showQRCodeModal(qrcodeImg.src, link.type);
                    };
                    
                    // Handle load error
                    qrcodeImg.onerror = () => {
                        qrcodeDiv.innerHTML = '<span class="qrcode-placeholder" title="二维码加载失败">📷</span>';
                    };
                    
                    qrcodeDiv.appendChild(qrcodeImg);
                    linkWrapper.appendChild(qrcodeDiv);
                    
                    // 添加提示文字
                    if (!link.url) {
                        const tipDiv = document.createElement('div');
                        tipDiv.className = 'qrcode-tip';
                        tipDiv.textContent = '点击二维码查看详细信息';
                        tipDiv.style.cssText = 'font-size: 12px; color: #999; margin-top: 4px;';
                        linkWrapper.appendChild(tipDiv);
                    }
                }
                
                linksContainer.appendChild(linkWrapper);
            }
        });
        
        if (hasValidLinks) {
            linksDiv.appendChild(linksContainer);
        } else {
            const noLinksMsg = document.createElement('p');
            noLinksMsg.textContent = '暂无外部链接';
            noLinksMsg.style.cssText = 'color: #999; font-style: italic; margin: 8px 0;';
            linksDiv.appendChild(noLinksMsg);
        }
    } else {
        const noLinksMsg = document.createElement('p');
        noLinksMsg.textContent = '暂无外部链接';
        noLinksMsg.style.cssText = 'color: #999; font-style: italic; margin: 8px 0;';
        linksDiv.appendChild(noLinksMsg);
    }
    
    // 定位按钮
    const locateBtn = content.querySelector('.locate-btn');
    locateBtn.onclick = () => locateClub(club);
    
    detailsDiv.innerHTML = '';
    detailsDiv.appendChild(content);
    
    sidebar.classList.add('active');
    toggleBtn.classList.add('hidden');
}

// 定位到社团
function locateClub(lat, lng) {
    // 支持 locateClub(lat, lng) 或 locateClub(club) 的调用方式
    let latitude, longitude;
    
    if (typeof lat === 'object' && lat !== null && lat.coordinates) {
        // 如果传入的是club对象
        const coords = lat.coordinates;
        longitude = coords[0];
        latitude = coords[1];
    } else if (typeof lat === 'object' && lat !== null && (lat.latitude !== undefined)) {
        // 如果传入的是包含latitude/longitude的对象
        latitude = lat.latitude;
        longitude = lat.longitude;
    } else {
        // 传入的是直接的坐标值
        latitude = lat;
        longitude = lng;
    }
    
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        console.warn('无效的坐标:', { latitude, longitude });
        return;
    }
    map.setZoomAndCenter(CONFIG.DETAIL_ZOOM, [longitude, latitude]); // 高德地图是[经度,纬度]
}

// 搜索功能
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }
        
        // 包含匹配搜索
        const results = clubsData.filter(club => 
            club.name.toLowerCase().includes(query) ||
            club.school.toLowerCase().includes(query) ||
            club.city.toLowerCase().includes(query) ||
            (club.tags && club.tags.some(tag => tag.toLowerCase().includes(query)))
        );
        
        if (results.length === 0) {
            searchResults.innerHTML = '';
            const p = document.createElement('p');
            p.style.cssText = 'padding: 10px; color: #999;';
            p.textContent = '未找到匹配';
            searchResults.appendChild(p);
            return;
        }
        
        // 使用模板渲染搜索结果
        searchResults.innerHTML = '';
        const template = document.getElementById('search-result-template');
        
        results.forEach(club => {
            const item = template.content.cloneNode(true);
            item.querySelector('h3').textContent = club.name;
            item.querySelector('p').textContent = `${club.school} - ${club.city}`;
            
            const div = item.querySelector('.search-result-item');
            div.onclick = () => selectSearchResult(`${club.name}|${club.school}`);
            
            searchResults.appendChild(item);
        });
    });
}

// 选择搜索结果
function selectSearchResult(clubIdentifier) {
    const club = clubsData.find(c => `${c.name}|${c.school}` === clubIdentifier);
    if (club) {
        showClubDetails(club);
        locateClub(club);
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }
}

/**
 * Show QR code in a modal dialog
 * @param {string} imageSrc - QR code image source
 * @param {string} title - Link type/title
 */
function showQRCodeModal(imageSrc, title) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('qrcodeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'qrcodeModal';
        modal.className = 'qrcode-modal';
        modal.innerHTML = `
            <div class="qrcode-modal-backdrop"></div>
            <div class="qrcode-modal-content">
                <button class="qrcode-modal-close" aria-label="关闭">&times;</button>
                <h3 class="qrcode-modal-title"></h3>
                <img class="qrcode-modal-image" src="" alt="二维码">
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close on backdrop or button click
        modal.querySelector('.qrcode-modal-backdrop').onclick = () => {
            modal.style.display = 'none';
        };
        modal.querySelector('.qrcode-modal-close').onclick = () => {
            modal.style.display = 'none';
        };
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }
    
    // Update content and show
    modal.querySelector('.qrcode-modal-title').textContent = `${title} 二维码`;
    modal.querySelector('.qrcode-modal-image').src = imageSrc;
    modal.style.display = 'flex';
}

// 侧边栏控制
function setupSidebar() {
    const closeSidebar = document.getElementById('closeSidebar');
    const toggleSidebar = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    
    // 展开侧边栏
    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.add('active');
        toggleSidebar.classList.add('hidden');
    });
    
    // 关闭侧边栏
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('active');
        toggleSidebar.classList.remove('hidden');
    });
    
    // 键盘导航支持
    document.addEventListener('keydown', (e) => {
        // Escape 键关闭侧边栏
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            toggleSidebar.classList.remove('hidden');
        }
    });
}

// 判断是否为中国省份
function isChineseProvince(province) {
    const chineseProvinces = [
        '北京市', '天津市', '上海市', '重庆市',
        '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
        '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
        '河南省', '湖北省', '湖南省', '广东省', '海南省',
        '四川省', '贵州省', '云南省', '陕西省', '甘肃省',
        '青海省', '台湾省', '内蒙古自治区', '广西壮族自治区', '西藏自治区',
        '宁夏回族自治区', '新疆维吾尔自治区', '香港特别行政区', '澳门特别行政区'
    ];
    return chineseProvinces.includes(province);
}

// 创建省份列表
function createProvinceList() {
    const provinceListContainer = document.getElementById('provinceList');
    
    // 省份简称映射表（标准二字简称）
    const provinceShortNames = {
        '北京市': '北京',
        '天津市': '天津',
        '上海市': '上海',
        '重庆市': '重庆',
        '河北省': '河北',
        '山西省': '山西',
        '辽宁省': '辽宁',
        '吉林省': '吉林',
        '黑龙江省': '黑龙江',
        '江苏省': '江苏',
        '浙江省': '浙江',
        '安徽省': '安徽',
        '福建省': '福建',
        '江西省': '江西',
        '山东省': '山东',
        '河南省': '河南',
        '湖北省': '湖北',
        '湖南省': '湖南',
        '广东省': '广东',
        '海南省': '海南',
        '四川省': '四川',
        '贵州省': '贵州',
        '云南省': '云南',
        '陕西省': '陕西',
        '甘肃省': '甘肃',
        '青海省': '青海',
        '台湾省': '台湾',
        '内蒙古自治区': '内蒙',
        '广西壮族自治区': '广西',
        '西藏自治区': '西藏',
        '宁夏回族自治区': '宁夏',
        '新疆维吾尔自治区': '新疆',
        '香港特别行政区': '香港',
        '澳门特别行政区': '澳门'
    };
    
    // 获取所有中国省份列表
    const allChineseProvinces = [
        '北京市', '天津市', '上海市', '重庆市',
        '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
        '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
        '河南省', '湖北省', '湖南省', '广东省', '海南省',
        '四川省', '贵州省', '云南省', '陕西省', '甘肃省',
        '青海省', '台湾省', '内蒙古自治区', '广西壮族自治区', '西藏自治区',
        '宁夏回族自治区', '新疆维吾尔自治区', '香港特别行政区', '澳门特别行政区'
    ];
    
    const existingProvinces = new Set();
    clubsData.forEach(club => {
        if (club.province) {
            existingProvinces.add(club.province);
        }
    });
    
    const allProvinces = new Set([...allChineseProvinces, ...existingProvinces]);
    
    // 转换为数组并排序
    const provinceArray = Array.from(allProvinces).sort((a, b) => {
        // 中国省份排在前面，其他排在后面
        const aIsChinese = isChineseProvince(a);
        const bIsChinese = isChineseProvince(b);
        
        if (aIsChinese && !bIsChinese) return -1;
        if (!aIsChinese && bIsChinese) return 1;
        
        return a.localeCompare(b);
    });
    
    // 添加"全部"选项
    provinceListContainer.innerHTML = '';
    
    // 创建"全部"按钮
    const allBtn = document.createElement('div');
    allBtn.className = 'province-item all active';
    allBtn.dataset.province = 'all';
    allBtn.textContent = '全部';
    allBtn.title = '全部';
    provinceListContainer.appendChild(allBtn);
    
    // 添加省份选项
    provinceArray.forEach(province => {
        const btn = document.createElement('div');
        btn.className = 'province-item';
        btn.dataset.province = province;
        const clubCount = clubsData.filter(club => club.province === province).length;
        
        // 使用简称或自定义短名称
        const shortName = provinceShortNames[province] || province.substring(0, 2);
        btn.textContent = shortName;
        btn.title = `${province}${clubCount > 0 ? ` (${clubCount})` : ''}`;
        
        provinceListContainer.appendChild(btn);
    });
    
    // 添加"其他地区"选项（仅包含海外和没有省份信息的社团）
    const otherBtn = document.createElement('div');
    otherBtn.className = 'province-item';
    otherBtn.dataset.province = '其他地区';
    const otherCount = clubsData.filter(club => !club.province).length;
    otherBtn.textContent = '其他';
    otherBtn.title = `其他地区${otherCount > 0 ? ` (${otherCount})` : ''}`;
    provinceListContainer.appendChild(otherBtn);
    
    // 添加点击事件
    provinceListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('province-item')) {
            const province = e.target.dataset.province;
            filterByProvince(province);
            
            // 更新激活状态
            document.querySelectorAll('.province-item').forEach(item => {
                item.classList.remove('active');
            });
            e.target.classList.add('active');
        }
    });
}

// 按省份过滤
function filterByProvince(province) {
    currentProvinceFilter = province;
    displayMarkers(province);
    
    // 自动展开侧边栏显示社团列表
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    sidebar.classList.add('active');
    toggleBtn.classList.add('hidden');
    
    // 显示该省份的社团列表
    showProvinceClubs(province);
}

// 显示省份社团列表
function showProvinceClubs(province) {
    const detailsDiv = document.getElementById('clubDetails');
    
    let filteredClubs = [];
    if (province === 'all') {
        // "全部"显示所有社团
        filteredClubs = clubsData;
    } else if (province === '其他地区') {
        // "其他地区"仅包含海外和没有省份信息的社团
        filteredClubs = clubsData.filter(club => !club.province);
    } else {
        filteredClubs = clubsData.filter(club => club.province === province);
    }
    
    if (filteredClubs.length === 0) {
        detailsDiv.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = '该省份暂无社团数据';
        detailsDiv.appendChild(p);
        return;
    }
    
    // 清空并创建标题
    detailsDiv.innerHTML = '';
    const title = document.createElement('h3');
    const provinceTitle = province === 'all' ? '全部' : province;
    title.textContent = `${provinceTitle}社团 (${filteredClubs.length}个)`;
    detailsDiv.appendChild(title);
    
    const listDiv = document.createElement('div');
    listDiv.className = 'province-clubs-list';
    
    const template = document.getElementById('province-club-template');
    
    filteredClubs.forEach(club => {
        const item = template.content.cloneNode(true);
        
        const logo = item.querySelector('.province-club-logo');
        logo.src = resolveLogoPath(club.logo);
        if (club.logo) {
            logo.style.display = 'block';
        } else {
            logo.style.display = 'none';
        }
        
        item.querySelector('h4').textContent = club.name;
        item.querySelector('p').textContent = `${club.school} - ${club.city}`;
        
        const clubItem = item.querySelector('.province-club-item');
        clubItem.onclick = () => selectClub(`${club.name}|${club.school}`);
        
        listDiv.appendChild(item);
    });
    
    detailsDiv.appendChild(listDiv);
}

// 选择社团（从省份列表中）
function selectClub(clubIdentifier) {
    const club = clubsData.find(c => `${c.name}|${c.school}` === clubIdentifier);
    if (club) {
        showClubDetails(club);
        locateClub(club);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    setupSearch();
    setupSidebar();
});
