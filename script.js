let map;
let markers = [];
let clubsData = [];
let currentProvinceFilter = null; // 当前选中的省份过滤器

const AMAP_KEY = '5cb8fcdd6990f463d15a601676fdb6d5';

// 初始化地图
function initMap() {
    try {
        // 创建地图实例，默认聚焦中国
        map = new AMap.Map('map', {
            zoom: 5,
            center: [104.1954, 35.8617],
            viewMode: '2D',
            lang: 'zh_cn'
        });

        console.log('高德地图初始化成功');
    } catch (error) {
        console.error('地图初始化失败:', error);
        alert('地图初始化失败，请检查网络连接。');
    }
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
    markers.forEach(markerObj => {
        map.remove(markerObj.marker);
    });
    markers = [];

    clubsData.forEach(club => {
        if (club.latitude && club.longitude) {
            // 如果有省份过滤器，检查是否匹配
            if (provinceFilter && provinceFilter !== 'all') {
                if (provinceFilter === '国外') {
                    // "国外"包括国外和没有省份信息的社团
                    if (!club.province || isChineseProvince(club.province)) {
                        return; // 跳过中国省份和有省份信息的社团
                    }
                } else if (club.province !== provinceFilter) {
                    return; // 跳过不匹配的省份
                }
            }

            const logoUrl = club.logo_url || 'assets/logos/placeholder.png';

            // 创建高德地图自定义图标
            const icon = new AMap.Icon({
                image: logoUrl,
                size: new AMap.Size(60, 60),        // 图标显示大小
                imageSize: new AMap.Size(60, 60),   // 图片大小
                imageOffset: new AMap.Pixel(0, 0)   // 图片偏移
            });

            // 创建高德地图标记
            const marker = new AMap.Marker({
                position: [club.longitude, club.latitude], // 高德地图是[经度,纬度]
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
    if (club.logo_url) {
        logoImg.src = club.logo_url;
        logoImg.style.display = 'block';
    } else {
        logoImg.style.display = 'none';
    }
    
    content.querySelector('.club-name').textContent = club.name;
    content.querySelector('.club-school').textContent = `${club.school} - ${club.city}, ${club.province}`;
    
    // 简介
    const descDiv = content.querySelector('.club-description');
    if (club.short_description || club.long_description) {
        let desc = '';
        if (club.short_description) {
            desc = `简介: ${club.short_description}`;
            if (club.long_description) desc += ` ${club.long_description}`;
        } else {
            desc = club.long_description;
        }
        descDiv.textContent = desc;
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
    if (club.external_links && club.external_links.length > 0) {
        linksDiv.innerHTML = '';
        const h3 = document.createElement('h3');
        h3.textContent = '外部链接';
        linksDiv.appendChild(h3);
        
        club.external_links.forEach(link => {
            const a = document.createElement('a');
            a.href = link.url;
            a.target = '_blank';
            a.className = 'link-item';
            a.textContent = `${link.type}: ${link.url}`;
            linksDiv.appendChild(a);
        });
    } else {
        linksDiv.style.display = 'none';
    }
    
    // 定位按钮
    const locateBtn = content.querySelector('.locate-btn');
    locateBtn.onclick = () => locateClub(club.latitude, club.longitude);
    
    detailsDiv.innerHTML = '';
    detailsDiv.appendChild(content);
    
    sidebar.classList.add('active');
    toggleBtn.classList.add('hidden');
}

// 定位到社团
function locateClub(lat, lng) {
    map.setZoomAndCenter(13, [lng, lat]); // 高德地图是[经度,纬度]
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
            div.onclick = () => selectSearchResult(club.id);
            
            searchResults.appendChild(item);
        });
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
    const provinceListContainer = document.getElementById('provinceList');
    
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
    provinceListContainer.innerHTML = '';
    
    // 创建"全部"按钮
    const allBtn = document.createElement('div');
    allBtn.className = 'province-item all active';
    allBtn.dataset.province = 'all';
    allBtn.textContent = '全部';
    provinceListContainer.appendChild(allBtn);
    
    // 添加省份选项
    provinceArray.forEach(province => {
        const btn = document.createElement('div');
        btn.className = 'province-item';
        btn.dataset.province = province;
        btn.textContent = province;
        provinceListContainer.appendChild(btn);
    });
    
    // 添加"其他"选项（国外）
    const otherBtn = document.createElement('div');
    otherBtn.className = 'province-item';
    otherBtn.dataset.province = '国外';
    otherBtn.textContent = '国外';
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
    } else if (province === '国外') {
        // "国外"包括国外和没有省份信息的社团
        filteredClubs = clubsData.filter(club => 
            !club.province || !isChineseProvince(club.province)
        );
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
        if (club.logo_url) {
            logo.src = club.logo_url;
        } else {
            logo.style.display = 'none';
        }
        
        item.querySelector('h4').textContent = club.name;
        item.querySelector('p').textContent = `${club.school} - ${club.city}`;
        
        const clubItem = item.querySelector('.province-club-item');
        clubItem.onclick = () => selectClub(club.id);
        
        listDiv.appendChild(item);
    });
    
    detailsDiv.appendChild(listDiv);
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
