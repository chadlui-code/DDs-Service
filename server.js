const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const locationStore = new Map();

// 生成简短ID
function generateId() {
    return crypto.randomBytes(4).toString('hex');
}

// 根据 Session ID 获取或创建
function getSessionId(parsedUrl, cookies) {
    // 1. 检查 URL 参数
    if (parsedUrl.query.id) return parsedUrl.query.id;
    
    // 2. 检查 Cookie
    const match = cookies.match(/locid=([^;]+)/);
    if (match) return match[1];
    
    // 3. 生成新的
    return generateId();
}

// 设置 Cookie
function setCookie(id) {
    return `locid=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>雷小豆定位</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .container { background: white; border-radius: 20px; padding: 40px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 5px; font-size: 24px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
        .status { padding: 15px 25px; border-radius: 50px; display: inline-block; margin: 15px 0; font-weight: 600; font-size: 14px; }
        .status.offline { background: #f8d7da; color: #721c24; }
        .status.getting { background: #fff3cd; color: #856404; }
        .status.online { background: #d4edda; color: #155724; }
        .location-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; display: none; }
        .location-box.show { display: block; }
        .coord { font-family: monospace; font-size: 16px; color: #333; margin: 8px 0; }
        .info { font-size: 12px; color: #666; margin-top: 15px; }
        .heartbeat { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px; font-size: 14px; color: #666; }
        .heart { color: #dc3545; font-size: 20px; }
        .heart.beating { animation: beat 1s infinite; }
        @keyframes beat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        .footer { margin-top: 30px; font-size: 12px; color: #999; }
        .session { font-size: 12px; color: #999; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📍</div>
        <h1>雷小豆定位</h1>
        <p class="subtitle">保持此页面运行，小豆随时获取你的位置</p>
        <div id="status" class="status offline">等待获取定位...</div>
        <div id="locationBox" class="location-box">
            <div class="coord">纬度: <span id="lat">-</span></div>
            <div class="coord">经度: <span id="lng">-</span></div>
            <div class="info">精度: ±<span id="acc">-</span>米</div>
        </div>
        <div id="heartbeat" class="heartbeat">
            <span class="heart" id="heartIcon">♥</span>
            <span id="heartbeatText">连接中...</span>
        </div>
        <div id="session" class="session">Session: <span id="sessionId">-</span></div>
        <div class="footer">页面保持后台运行即可</div>
    </div>
    <script>
        let loc = null, heartbeatInterval = null;
        const HEARTBEAT_INTERVAL = 900000;
        let sessionId = null;
        
        // 从URL或Cookie获取session ID
        function getSessionId() {
            const params = new URLSearchParams(window.location.search);
            if (params.has('id')) return params.get('id');
            const match = document.cookie.match(/locid=([^;]+)/);
            return match ? match[1] : null;
        }
        
        // 保存session ID到URL和Cookie
        function saveSessionId(id) {
            sessionId = id;
            document.getElementById('sessionId').textContent = id;
            // 写入Cookie
            document.cookie = 'locid=' + id + '; path=/; max-age=31536000';
            // 更新URL（不刷新页面）
            const url = new URL(window.location);
            url.searchParams.set('id', id);
            window.history.replaceState({}, '', url);
        }
        
        function updateStatus(t, c) { document.getElementById('status').textContent = t; document.getElementById('status').className = 'status ' + c; }
        
        function getLocation() {
            if (!navigator.geolocation) { updateStatus('浏览器不支持定位', 'offline'); return Promise.reject(); }
            return new Promise((resolve, reject) => {
                updateStatus('获取中...', 'getting');
                navigator.geolocation.getCurrentPosition(p => {
                    loc = p.coords;
                    document.getElementById('lat').textContent = loc.latitude.toFixed(6);
                    document.getElementById('lng').textContent = loc.longitude.toFixed(6);
                    document.getElementById('acc').textContent = Math.round(loc.accuracy);
                    updateStatus('✓ 定位已同步', 'online');
                    document.getElementById('locationBox').className = 'location-box show';
                    uploadLocation().then(() => resolve()).catch(() => resolve());
                }, e => {
                    let m = '定位失败';
                    if (e.code === 1) m = '请允许定位权限';
                    updateStatus(m, 'offline');
                    reject(m);
                }, { timeout: 10000 });
            });
        }
        
        function uploadLocation() {
            if (!loc || !sessionId) return Promise.reject();
            return fetch('/api/location?id=' + sessionId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy })
            }).then(r => r.json()).then(d => {
                if (d.success) {
                    let t = new Date();
                    document.getElementById('heartbeatText').textContent = '已同步 ' + t.toLocaleTimeString('zh-CN');
                }
            });
        }
        
        function startHeartbeat() {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            document.getElementById('heartIcon').classList.add('beating');
            heartbeatInterval = setInterval(() => getLocation().catch(() => {}), HEARTBEAT_INTERVAL);
            updateStatus('✓ 实时同步中', 'online');
        }
        
        function init() {
            // 获取或生成session ID
            const id = getSessionId();
            if (id) {
                saveSessionId(id);
                // 立即获取位置
                getLocation().then(() => startHeartbeat());
            } else {
                // 获取新ID
                fetch('/api/new-session').then(r => r.json()).then(d => {
                    saveSessionId(d.id);
                    getLocation().then(() => startHeartbeat());
                });
            }
        }
        
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') getLocation(); });
        window.onload = init;
    </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const sessionId = parsedUrl.query.id;
    const cookies = req.headers.cookie || '';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // GET /api/new-session - 创建新Session
    if (path === '/api/new-session' && req.method === 'GET') {
        const id = generateId();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Set-Cookie': setCookie(id)
        });
        res.end(JSON.stringify({ id }));
        return;
    }

    // POST /api/location - 用户上传位置（用Session ID）
    if (path === '/api/location' && req.method === 'POST' && sessionId) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                locationStore.set(sessionId, {
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracy: data.accuracy,
                    timestamp: new Date().toISOString()
                });
                console.log(`[位置更新] ${sessionId} -> ${data.latitude}, ${data.longitude}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // GET /api/location - 获取位置（用Session ID）
    if (path === '/api/location' && req.method === 'GET' && sessionId) {
        const location = locationStore.get(sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (location) {
            res.end(JSON.stringify({ success: true, location, id: sessionId }));
        } else {
            res.end(JSON.stringify({ success: false, message: '暂无位置' }));
        }
        return;
    }

    // GET /api/all - 获取所有位置（调试用）
    if (path === '/api/all' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const all = {};
        locationStore.forEach((v, k) => all[k] = v);
        res.end(JSON.stringify({ count: locationStore.size, locations: all }));
        return;
    }

    // 首页
    if (path === '/' && req.method === 'GET') {
        res.writeHead(200, { 
            'Content-Type': 'text/html; charset=utf-8',
            'Set-Cookie': sessionId ? setCookie(sessionId) : ''
        });
        res.end(HTML);
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = server;
