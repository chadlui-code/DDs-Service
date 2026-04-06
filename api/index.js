// Vercel API - 定位服务（常驻模式）
// 用户打开页面后位置实时更新，小豆随时来取

const locationStore = new Map();

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

module.exports = (req, res) => {
  const ip = getClientIP(req);
  const url = req.url.split('?')[0];
  
  // POST /api/location - 用户上传位置
  if (req.method === 'POST' && url === '/api/location') {
    try {
      const body = JSON.parse(req.body || '{}');
      const location = {
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
        timestamp: new Date().toISOString()
      };
      
      locationStore.set(ip, location);
      console.log(`[位置更新] ${ip} -> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
      return;
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false }));
      return;
    }
  }
  
  // GET /api/location - 获取位置
  if (req.method === 'GET' && url === '/api/location') {
    const location = locationStore.get(ip);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (location) {
      res.end(JSON.stringify({ success: true, location }));
    } else {
      res.end(JSON.stringify({ success: false, message: '暂无位置' }));
    }
    return;
  }
  
  // GET /api/status - 获取当前状态
  if (req.method === 'GET' && url === '/api/status') {
    const location = locationStore.get(ip);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.end(JSON.stringify({
      online: !!location,
      lastUpdate: location?.timestamp || null,
      latency: Date.now() - new Date(location?.timestamp).getTime() + 'ms'
    }));
    return;
  }
  
  // 首页
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(getHTML());
    return;
  }
  
  res.statusCode = 404;
  res.end('Not Found');
};

function getHTML() {
  return `<!DOCTYPE html>
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
        .status.error { background: #f8d7da; color: #721c24; }
        .location-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; display: none; }
        .location-box.show { display: block; }
        .coord { font-family: monospace; font-size: 16px; color: #333; margin: 8px 0; }
        .info { font-size: 12px; color: #666; margin-top: 15px; }
        .heartbeat { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px; font-size: 14px; color: #666; }
        .heart { color: #dc3545; font-size: 20px; }
        .heart.beating { animation: beat 1s infinite; }
        @keyframes beat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        .footer { margin-top: 30px; font-size: 12px; color: #999; }
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
        
        <div class="footer">页面保持后台运行即可 · 无需任何操作</div>
    </div>
    
    <script>
        let loc = null;
        let lastUpload = null;
        let uploadInterval = null;
        
        const HEARTBEAT_INTERVAL = 900000; // 15分钟刷新一次位置
        
        function updateStatus(text, className) {
            document.getElementById('status').textContent = text;
            document.getElementById('status').className = 'status ' + className;
        }
        
        function getLocation() {
            if (!navigator.geolocation) {
                updateStatus('浏览器不支持定位', 'error');
                return;
            }
            
            navigator.geolocation.getCurrentPosition((p) => {
                loc = p.coords;
                document.getElementById('lat').textContent = loc.latitude.toFixed(6);
                document.getElementById('lng').textContent = loc.longitude.toFixed(6);
                document.getElementById('acc').textContent = Math.round(loc.accuracy);
                
                updateStatus('✓ 定位已同步', 'online');
                document.getElementById('locationBox').className = 'location-box show';
                
                // 立即上传一次
                uploadLocation();
                
                // 开始定时上传
                startHeartbeat();
                
            }, (e) => {
                let msg = '定位失败';
                if (e.code === 1) msg = '请允许定位权限';
                else if (e.code === 2) msg = '定位服务不可用';
                updateStatus(msg, 'error');
            }, { timeout: 10000 });
        }
        
        function uploadLocation() {
            if (!loc) return;
            
            fetch('/api/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    accuracy: loc.accuracy
                })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    lastUpload = new Date();
                    document.getElementById('heartbeatText').textContent = 
                        '已同步 ' + lastUpload.toLocaleTimeString('zh-CN');
                }
            }).catch(() => {});
        }
        
        function startHeartbeat() {
            if (uploadInterval) clearInterval(uploadInterval);
            
            const heartIcon = document.getElementById('heartIcon');
            heartIcon.classList.add('beating');
            
            uploadInterval = setInterval(() => {
                // 刷新GPS位置
                navigator.geolocation.getCurrentPosition((p) => {
                    loc = p.coords;
                    document.getElementById('lat').textContent = loc.latitude.toFixed(6);
                    document.getElementById('lng').textContent = loc.longitude.toFixed(6);
                    document.getElementById('acc').textContent = Math.round(loc.accuracy);
                    
                    // 上传到服务器
                    uploadLocation();
                    
                }, () => {}, { timeout: 5000 });
            }, HEARTBEAT_INTERVAL);
            
            updateStatus('✓ 实时同步中', 'online');
        }
        
        // 页面可见性变化时保持运行
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                getLocation();
            }
        });
        
        window.onload = getLocation;
        window.onunload = () => { if (uploadInterval) clearInterval(uploadInterval); };
    </script>
</body>
</html>`;
}
