const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const CLUBS_DATA_PATH = path.join(__dirname, '..', 'data', 'clubs.json');

// 预缓存配置
const config = {
    zoomLevels: [5, 8, 10, 13, 15],
    sizes: ['400*400', '600*400', '800*600'],
    concurrency: 5,
    delay: 100
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 请求单个地图数据并缓存
async function cacheMap(lng, lat, zoom, size) {
    const params = new URLSearchParams({
        location: `${lng},${lat}`,
        zoom: zoom,
        size: size,
        markers: `mid,,A:${lng},${lat}`
    });

    const url = `${SERVER_URL}/api/staticmap?${params.toString()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const cacheStatus = response.headers.get('X-Cache') || 'UNKNOWN';
        return { success: true, status: cacheStatus };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function preCacheAllClubs() {
    if (!fs.existsSync(CLUBS_DATA_PATH)) {
        console.error(`Error: clubs.json not found at ${CLUBS_DATA_PATH}`);
        process.exit(1);
    }

    const clubsData = JSON.parse(fs.readFileSync(CLUBS_DATA_PATH, 'utf8'));
    const validClubs = clubsData.filter(club => club.latitude && club.longitude);

    console.log(`Total clubs: ${clubsData.length}`);
    console.log(`Valid clubs: ${validClubs.length}`);

    // 生成所有预缓存任务：每个社团 x 每个缩放级别 x 每个尺寸
    const tasks = [];
    for (const club of validClubs) {
        for (const zoom of config.zoomLevels) {
            for (const size of config.sizes) {
                tasks.push({ lng: club.longitude, lat: club.latitude, zoom, size });
            }
        }
    }

    console.log(`Total tasks: ${tasks.length}`);
    console.log(`Starting pre-cache...`);

    let completed = 0;
    let cached = 0;
    let errors = 0;

    // 分批并发请求，避免过载服务器
    for (let i = 0; i < tasks.length; i += config.concurrency) {
        const batch = tasks.slice(i, i + config.concurrency);
        const promises = batch.map(task => cacheMap(task.lng, task.lat, task.zoom, task.size));
        const results = await Promise.all(promises);

        results.forEach(result => {
            completed++;
            if (result.success) {
                if (result.status === 'MISS') {
                    cached++;
                }
            } else {
                errors++;
            }
        });

        const progress = Math.round((completed / tasks.length) * 100);
        process.stdout.write(`\rProgress: ${progress}% (${completed}/${tasks.length}) - Cached: ${cached}, Errors: ${errors}`);

        if (i + config.concurrency < tasks.length) {
            await delay(config.delay);
        }
    }

    console.log(`\n\nPre-cache completed`);
    console.log(`Total: ${completed}, Cached: ${cached}, Errors: ${errors}`);

    try {
        const statsResponse = await fetch(`${SERVER_URL}/api/cache/stats`);
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            console.log(`\nCache statistics:`);
            console.log(`Permanent: ${stats.permanent.files} files, ${stats.permanent.sizeMB} MB`);
            console.log(`Temp: ${stats.temp.files} files, ${stats.temp.sizeMB} MB`);
        }
    } catch (error) {
        console.error('Failed to fetch cache stats');
    }
}

if (require.main === module) {
    preCacheAllClubs().catch(error => {
        console.error('Pre-cache failed:', error);
        process.exit(1);
    });
}

module.exports = { preCacheAllClubs };
