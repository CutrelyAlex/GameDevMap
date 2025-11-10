let map;
let markers = [];
let clubsData = [];
let markerClusterGroup;
let currentProvinceFilter = null; // 当前选中的省份过滤器

// 初始化地图
function initMap() {
    // 创建地图，默认聚焦中国
    map = L.map('map').setView([35.8617, 104.1954], 5);
    
    // 添加地图瓦片层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
    
    // 初始化标记聚合组 
    markerClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 6,  // 不聚合的最大缩放级别
        maxClusterRadius: 50,         // 聚合半径
        spiderfyOnMaxZoom: true,      // 在最大缩放级别展开聚合
        showCoverageOnHover: false,   // 鼠标悬停时不显示覆盖范围
        zoomToBoundsOnClick: true     // 点击聚合时缩放到边界
    });
    map.addLayer(markerClusterGroup);
}

// 加载数据
async function loadData() {
    try {
        const response = await fetch('data/clubs.json');
        clubsData = await response.json();
        displayMarkers();
        createProvinceList();
    } catch (error) {
        console.error('加载数据失败:', error);
        alert('数据加载失败，请检查 data/clubs.json 文件是否存在');
    }
}

// 显示标记
function displayMarkers(provinceFilter = null) {
    // 清除现有标记
    markerClusterGroup.clearLayers();
    markers = [];
    
    clubsData.forEach(club => {
        if (club.latitude && club.longitude) {
            // 如果有省份过滤器，检查是否匹配
            if (provinceFilter && provinceFilter !== 'all') {
                if (provinceFilter === '其他') {
                    // "其他"包括国外和没有省份信息的社团
                    if (club.province && club.province !== '其他' && !isChineseProvince(club.province)) {
                        // 跳过不符合条件的社团
                    } else if (!club.province || isChineseProvince(club.province)) {
                        return; // 跳过中国省份的社团
                    }
                } else if (club.province !== provinceFilter) {
                    return; // 跳过不匹配的省份
                }
            }
            
            const logoUrl = club.logo_url || 'assets/logos/placeholder.png';
            const icon = L.icon({
                iconUrl: logoUrl,
                iconSize: [60, 60],     
                iconAnchor: [30, 60],    // 调整锚点位置（图标中心底部）
                popupAnchor: [0, -60],   // 调整弹出框位置
                loading: 'lazy'
            });
            
            // 创建标记
            const marker = L.marker([club.latitude, club.longitude], { icon })
                .bindPopup(club.name);
            
            // 添加点击事件
            marker.on('click', () => {
                showClubDetails(club);
            });
            
            markers.push({ marker, club });
            markerClusterGroup.addLayer(marker);
        }
    });
}

// 显示社团详情
function showClubDetails(club) {
    const detailsDiv = document.getElementById('clubDetails');
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    
    let linksHtml = '';
    if (club.external_links && club.external_links.length > 0) {
        linksHtml = '<div class="club-links"><h3>外部链接</h3>';
        club.external_links.forEach(link => {
            linksHtml += `<a href="${link.url}" target="_blank" class="link-item">${link.type}: ${link.url}</a>`;
        });
        linksHtml += '</div>';
    }
    
    let tagsHtml = '';
    if (club.tags && club.tags.length > 0) {
        tagsHtml = '<div class="club-tags">';
        club.tags.forEach(tag => {
            tagsHtml += `<span class="tag">${tag}</span>`;
        });
        tagsHtml += '</div>';
    }
    
    detailsDiv.innerHTML = `
        ${club.logo_url ? `<img src="${club.logo_url}" alt="${club.name}" class="club-logo">` : ''}
        <h2 class="club-name">${club.name}</h2>
        <p class="club-school">${club.school} - ${club.city}, ${club.province}</p>
        ${club.short_description ? `<p class="club-description"><strong>简介:</strong> ${club.short_description}</p>` : ''}
        ${club.long_description ? `<p class="club-description">${club.long_description}</p>` : ''}
        ${tagsHtml}
        ${linksHtml}
        <button class="locate-btn" onclick="locateClub(${club.latitude}, ${club.longitude})">定位到地图</button>
    `;
    
    // 自动展开侧边栏
    sidebar.classList.add('active');
    toggleBtn.classList.add('hidden');
}

// 定位到社团
function locateClub(lat, lng) {
    map.setView([lat, lng], 13);
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
            searchResults.innerHTML = '<p style="padding: 10px; color: #999;">未找到匹配</p>';
            return;
        }
        
        searchResults.innerHTML = results.map(club => `
            <div class="search-result-item" onclick="selectSearchResult('${club.id}')">
                <h3>${club.name}</h3>
                <p>${club.school} - ${club.city}</p>
            </div>
        `).join('');
    });
}

// 选择搜索结果
function selectSearchResult(clubId) {
    const club = clubsData.find(c => c.id === clubId);
    if (club) {
        showClubDetails(club);
        locateClub(club.latitude, club.longitude);
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }
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
    const provinceList = document.getElementById('provinceList');
    
    // 提取所有省份并去重
    const provinces = new Set();
    clubsData.forEach(club => {
        if (club.province) {
            provinces.add(club.province);
        }
    });
    
    // 转换为数组并排序
    const provinceArray = Array.from(provinces).sort((a, b) => {
        // 中国省份排在前面，其他排在后面
        const aIsChinese = isChineseProvince(a);
        const bIsChinese = isChineseProvince(b);
        
        if (aIsChinese && !bIsChinese) return -1;
        if (!aIsChinese && bIsChinese) return 1;
        
        return a.localeCompare(b);
    });
    
    // 添加"全部"选项
    let html = '<div class="province-item all active" data-province="all">全部</div>';
    
    // 添加省份选项
    provinceArray.forEach(province => {
        html += `<div class="province-item" data-province="${province}">${province}</div>`;
    });
    
    // 添加"其他"选项（国外）
    html += '<div class="province-item" data-province="其他">其他</div>';
    
    provinceList.innerHTML = html;
    
    // 添加点击事件
    provinceList.addEventListener('click', (e) => {
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
    
    // 如果不是"全部"，自动展开侧边栏显示社团列表
    if (province !== 'all') {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('toggleSidebar');
        sidebar.classList.add('active');
        toggleBtn.classList.add('hidden');
        
        // 显示该省份的社团列表
        showProvinceClubs(province);
    }
}

// 显示省份社团列表
function showProvinceClubs(province) {
    const detailsDiv = document.getElementById('clubDetails');
    
    let filteredClubs = [];
    if (province === '其他') {
        // "其他"包括国外和没有省份信息的社团
        filteredClubs = clubsData.filter(club => 
            !club.province || !isChineseProvince(club.province)
        );
    } else {
        filteredClubs = clubsData.filter(club => club.province === province);
    }
    
    if (filteredClubs.length === 0) {
        detailsDiv.innerHTML = `<p>该省份暂无社团数据</p>`;
        return;
    }
    
    let html = `<h3>${province}的社团 (${filteredClubs.length}个)</h3>`;
    html += '<div class="province-clubs-list">';
    
    filteredClubs.forEach(club => {
        html += `
            <div class="province-club-item" onclick="selectClub('${club.id}')">
                ${club.logo_url ? `<img src="${club.logo_url}" alt="${club.name}" class="province-club-logo">` : ''}
                <div class="province-club-info">
                    <h4>${club.name}</h4>
                    <p>${club.school} - ${club.city}</p>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    detailsDiv.innerHTML = html;
}

// 选择社团（从省份列表中）
function selectClub(clubId) {
    const club = clubsData.find(c => c.id === clubId);
    if (club) {
        showClubDetails(club);
        locateClub(club.latitude, club.longitude);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    setupSearch();
    setupSidebar();
});
