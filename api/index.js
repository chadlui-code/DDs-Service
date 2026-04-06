// Vercel API - 定位服务（按需模式）
// 当需要时：1.小豆告诉用户打开页面 2.用户上传位置 3.小豆获取

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
      console.log(`[位置更新] IP: ${ip}`, location);
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        success: true, 
        message: '位置已上传成功',
        timestamp: location.timestamp 
      }));
      return;
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
      return;
    }
  }
  
  // GET /api/location - 获取自己的位置（用户端）
  if (req.method === 'GET' && url === '/api/location') {
    const location = locationStore.get(ip);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (location) {
      res.end(JSON.stringify({ success: true, location }));
    } else {
      res.end(JSON.stringify({ success: false, message: '暂无位置，请先获取定位' }));
    }
    return;
  }
  
  // GET /api/my-location - 获取自己的位置（简洁版）
  if (req.method === 'GET' && url === '/api/my-location') {
    const location = locationStore.get(ip);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (location) {
      // 直接返回坐标文本，方便解析
      const text = `纬度:${location.latitude.toFixed(6)},经度:${location.longitude.toFixed(6)},时间:${location.timestamp}`;
      res.end(text);
    } else {
      res.end('暂无位置');
    }
    return;
  }
  
  // 首页
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
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
        .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
        .status { padding: 15px 25px; border-radius: 50px; display: inline-block; margin: 15px 0; font-weight: 600; font-size: 14px; }
        .status.waiting { background: #fff3cd; color: #856404; }
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .status.uploading { background: #cce5ff; color: #004085; }
        .location-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; display: none; }
        .location-box.show { display: block; }
        .coord { font-family: monospace; font-size: 14px; color: #333; margin: 5px 0; }
        .btn { background: #667eea; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer; width: 100%; max-width: 200px; }
        .btn:hover { background: #5568d3; }
        .btn:disabled { background: #ccc; cursor: not-allowed; }
        .success-msg { color: #28a745; font-size: 14px; margin-top: 15px; display: none; }
        .success-msg.show { display: block; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📍</div>
        <h1>雷小豆定位</h1>
        <p class="subtitle">获取GPS位置并发给雷小豆</p>
        
        <div id="status" class="status waiting">正在获取定位...</div>
        <div id="locationBox" class="location-box">
            <div class="coord">纬度: <span id="lat">-</span></div>
            <div class="coord">经度: <span id="lng">-</span></div>
        </div>
        
        <button id="btn" class="btn" onclick="getLocation()">获取定位</button>
        
        <div id="successMsg" class="success-msg">✓ 位置已发送给雷小豆</div>
        
        <div class="footer">雷小豆正在等待你的位置...</div>
    </div>
    
    <script>
        let loc = null;
        let uploaded = false;
        
        function updateStatus(text, className) {
            const s = document.getElementById('status');
            s.textContent = text;
            s.className = 'status ' + className;
        }
        
        function getLocation() {
            const btn = document.getElementById('btn');
            
            if (!navigator.geolocation) {
                updateStatus('浏览器不支持定位', 'error');
                return;
            }
            
            updateStatus('获取中...', 'waiting');
            btn.disabled = true;
            btn.textContent = '获取中...';
            
            navigator.geolocation.getCurrentPosition((p) => {
                loc = p.coords;
                document.getElementById('lat').textContent = loc.latitude.toFixed(6);
                document.getElementById('lng').textContent = loc.longitude.toFixed(6);
                
                updateStatus('✓ 获取成功，正在发送...', 'uploading');
                document.getElementById('locationBox').className = 'location-box show';
                
                // 上传到服务器
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
                        updateStatus('✓ 已发送给雷小豆', 'success');
                        document.getElementById('successMsg').className = 'success-msg show';
                        btn.textContent = '重新获取';
                        uploaded = true;
                    } else {
                        updateStatus('发送失败，请重试', 'error');
                    }
                }).catch(() => {
                    updateStatus('发送失败，请重试', 'error');
                });
                
                btn.disabled = false;
            }, (e) => {
                let msg = '定位失败';
                if (e.code === 1) msg = '请允许定位权限';
                else if (e.code === 2) msg = '定位服务不可用';
                else if (e.code === 3) msg = '定位超时';
                updateStatus(msg, 'error');
                btn.textContent = '重试';
                btn.disabled = false;
            }, { timeout: 30000 });
        }
        
        window.onload = getLocation;
    </script>
</body>
</html>`;
}
