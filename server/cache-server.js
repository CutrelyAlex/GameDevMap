const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 缓存目录配置
const CACHE_DIR = path.join(__dirname, '..', 'map-cache');
const PERMANENT_CACHE_DIR = path.join(CACHE_DIR, 'permanent');
const TEMP_CACHE_DIR = path.join(CACHE_DIR, 'temp');
const TEMP_CACHE_MAX_AGE = parseInt(process.env.CACHE_MAX_AGE) || 7 * 24 * 60 * 60 * 1000;
const AMAP_KEY = process.env.AMAP_KEY || '5cb8fcdd6990f463d15a601676fdb6d5';

// 初始化缓存目录
[CACHE_DIR, PERMANENT_CACHE_DIR, TEMP_CACHE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

function getCacheKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

function getCachePath(cacheKey, isPermanent = false) {
    const baseDir = isPermanent ? PERMANENT_CACHE_DIR : TEMP_CACHE_DIR;
    const subDir = cacheKey.substring(0, 2);
    const dir = path.join(baseDir, subDir);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, cacheKey);
}

function isCacheValid(cachePath, isPermanent = false) {
    if (!fs.existsSync(cachePath)) {
        return false;
    }
    // 永久缓存始终有效
    if (isPermanent) {
        return true;
    }
    // 临时缓存检查是否过期
    const stats = fs.statSync(cachePath);
    const age = Date.now() - stats.mtime.getTime();
    return age < TEMP_CACHE_MAX_AGE;
}

// 判断是否为社团位置地图（包含location和markers参数）
function isClubLocation(params) {
    const location = params.get('location');
    const markers = params.get('markers');
    return location && markers;
}

app.use(express.static(path.join(__dirname, '..')));

// 静态地图API代理：优先返回缓存，缓存未命中则从API获取并缓存
app.get('/api/staticmap', async (req, res) => {
    const params = new URLSearchParams(req.query);
    params.set('key', AMAP_KEY);
    
    const apiUrl = `https://restapi.amap.com/v3/staticmap?${params.toString()}`;
    const cacheKey = getCacheKey(apiUrl);
    const isPermanent = isClubLocation(params);
    const cachePath = getCachePath(cacheKey, isPermanent);
    const metaPath = cachePath + '.meta';

    try {
        // 尝试从缓存读取
        if (isCacheValid(cachePath, isPermanent) && fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            res.set('Content-Type', meta.contentType);
            res.set('X-Cache', 'HIT');
            res.set('X-Cache-Type', isPermanent ? 'PERMANENT' : 'TEMP');
            res.send(fs.readFileSync(cachePath));
            return;
        }

        // 缓存未命中，从API获取
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const buffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'image/png';

        // 保存到缓存
        fs.writeFileSync(cachePath, buffer);
        fs.writeFileSync(metaPath, JSON.stringify({
            contentType,
            url: apiUrl,
            timestamp: Date.now(),
            permanent: isPermanent
        }));

        res.set('Content-Type', contentType);
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Type', isPermanent ? 'PERMANENT' : 'TEMP');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cache/clear', (req, res) => {
    try {
        const clearPermanent = req.query.permanent === 'true';
        const targetDir = clearPermanent ? PERMANENT_CACHE_DIR : TEMP_CACHE_DIR;
        
        let count = 0;
        function clearDir(dir) {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    clearDir(filePath);
                } else {
                    fs.unlinkSync(filePath);
                    count++;
                }
            });
        }
        
        clearDir(targetDir);
        res.json({ success: true, deleted: count, type: clearPermanent ? 'permanent' : 'temp' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 返回缓存统计信息
app.get('/api/cache/stats', (req, res) => {
    try {
        const stats = { permanent: {}, temp: {} };
        
        function scanDir(dir, type) {
            let totalFiles = 0;
            let totalSize = 0;
            
            function scan(d) {
                if (!fs.existsSync(d)) return;
                const files = fs.readdirSync(d);
                files.forEach(file => {
                    const filePath = path.join(d, file);
                    const s = fs.statSync(filePath);
                    if (s.isDirectory()) {
                        scan(filePath);
                    } else if (s.isFile() && !file.endsWith('.meta')) {
                        totalFiles++;
                        totalSize += s.size;
                    }
                });
            }
            
            scan(dir);
            stats[type] = {
                files: totalFiles,
                sizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
            };
        }
        
        scanDir(PERMANENT_CACHE_DIR, 'permanent');
        scanDir(TEMP_CACHE_DIR, 'temp');
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    console.log(`Cache directory: ${CACHE_DIR}`);
});
