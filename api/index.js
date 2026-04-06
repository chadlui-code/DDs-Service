// Vercel API - 定位服务
// 存储结构：IP地址 -> 位置信息

// 简单的内存存储（Vercel Serverless 会定期重置）
const locationStore = new Map();

// 获取客户端IP
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
}

// 首页 - 显示定位页面
module.exports = (req, res) => {
  const ip = getClientIP(req);
  
  // POST /api/location - 保存位置
  if (req.method === 'POST' && req.url === '/api/location') {
    try {
      const body = JSON.parse(req.body || '{}');
      const location = {
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'] || 'unknown'
      };
      
      locationStore.set(ip, location);
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, ip, timestamp: location.timestamp }));
      return;
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
      return;
    }
  }
  
  // GET /api/location - 获取位置
  if (req.method === 'GET' && req.url === '/api/location') {
    const location = locationStore.get(ip);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (location) {
      res.end(JSON.stringify({
        success: true,
        ip,
        location
      }));
    } else {
      res.end(JSON.stringify({
        success: false,
        message: '暂无位置信息，请先打开页面获取定位'
      }));
    }
    return;
  }
  
  // GET /api/location/[ip] - 获取指定IP的位置（供雷小豆服务器轮询）
  const locationPath = '/api/location/';
  if (req.method === 'GET' && req.url.startsWith(locationPath)) {
    const targetIP = req.url.substring(locationPath.length);
    const location = locationStore.get(decodeURIComponent(targetIP));
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (location) {
      res.end(JSON.stringify({
        success: true,
        ip: targetIP,
        location
      }));
    } else {
      res.end(JSON.stringify({
        success: false,
        message: '未找到该IP的位置信息'
      }));
    }
    return;
  }
  
  // GET /api/all - 获取所有存储的位置（管理员用）
  if (req.method === 'GET' && req.url === '/api/all') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      count: locationStore.size,
      locations: Object.fromEntries(locationStore)
    }));
    return;
  }
  
  // 首页 - 定位页面HTML
  if (req.method === 'GET' || req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(getHTML());
    return;
  }
  
  // 404
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
        h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
        .status { padding: 15px 25px; border-radius: 50px; display: inline-block; margin: 20px 0; font-weight: 600; font-size: 14px; }
        .status.waiting { background: #fff3cd; color: #856404; }
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .status.sending { background: #cce5ff; color: #004085; }
        .location-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; display: none; }
        .location-box.show { display: block; }
        .coord { font-family: monospace; font-size: 14px; color: #333; margin: 5px 0; }
        .btn { background: #667eea; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #5568d3; }
        .btn:disabled { background: #ccc; }
        .share-btn { background: #28a745; margin-top: 15px; }
        .share-btn:hover { background: #218838; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; }
        .auto-notice { font-size: 12px; color: #666; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📍</div>
        <h1>雷小豆定位</h1>
        <div id="status" class="status waiting">正在获取定位...</div>
        <div id="locationBox" class="location-box">
            <div class="coord">纬度: <span id="lat">-</span></div>
            <div class="coord">经度: <span id="lng">-</span></div>
        </div>
        <button id="btn" class="btn" onclick="getLocation()">获取定位</button>
        <div id="shareSection" style="margin-top:20px;display:none;">
            <div id="sendStatus" class="status sending" style="display:none;">正在上传位置...</div>
            <button class="btn share-btn" onclick="copyLocation()">📋 复制位置</button>
            <p class="auto-notice" id="autoNotice" style="display:none;">✓ 已自动发送给雷小豆</p>
        </div>
        <div class="footer">定位仅供本次使用 · 关闭页面后失效</div>
    </div>
    
    <script>
        let loc = null;
        
        function getLocation() {
            const s = document.getElementById('status');
            const btn = document.getElementById('btn');
            
            if (!navigator.geolocation) {
                s.textContent = '浏览器不支持定位';
                s.className = 'status error';
                return;
            }
            
            s.textContent = '获取中...';
            s.className = 'status waiting';
            btn.disabled = true;
            
            navigator.geolocation.getCurrentPosition((p) => {
                loc = p.coords;
                document.getElementById('lat').textContent = loc.latitude.toFixed(6);
                document.getElementById('lng').textContent = loc.longitude.toFixed(6);
                s.textContent = '✓ 成功';
                s.className = 'status success';
                document.getElementById('locationBox').className = 'location-box show';
                document.getElementById('shareSection').style.display = 'block';
                btn.textContent = '刷新定位';
                btn.disabled = false;
                
                // 自动发送到服务器
                sendToServer();
            }, (e) => {
                s.textContent = e.code === 1 ? '请允许定位' : '定位失败';
                s.className = 'status error';
                btn.textContent = '重试';
                btn.disabled = false;
            }, {timeout: 30000});
        }
        
        function sendToServer() {
            if (!loc) return;
            
            const sendStatus = document.getElementById('sendStatus');
            const autoNotice = document.getElementById('autoNotice');
            
            sendStatus.style.display = 'inline-block';
            
            fetch('/api/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    accuracy: loc.accuracy
                })
            }).then(r => r.json()).then(data => {
                console.log('已上传:', data);
                sendStatus.style.display = 'none';
                autoNotice.style.display = 'block';
            }).catch(err => {
                console.error('上传失败:', err);
                sendStatus.style.display = 'none';
            });
        }
        
        function copyLocation() {
            if (!loc) return;
            const t = '我的位置：纬度 ' + loc.latitude.toFixed(6) + '，经度 ' + loc.longitude.toFixed(6);
            navigator.clipboard.writeText(t).then(() => {
                alert('已复制！可以粘贴给雷小豆了。');
            });
        }
        
        // 页面加载时自动获取定位
        window.onload = getLocation;
    </script>
</body>
</html>`;
}
