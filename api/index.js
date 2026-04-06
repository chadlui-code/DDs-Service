// Vercel API - 定位服务（常驻模式）
// 用户打开页面后位置实时更新，小豆随时来取
// 支持小豆主动触发刷新

const locationStore = new Map();
const commandStore = new Map(); // IP -> { cmd, timestamp }

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

module.exports = (req, res) => {
  const ip = getClientIP(req);
  const url = req.url.split('?')[0];
  
  // ==================== 用户端 API ====================
  
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
  
  // GET /api/command - 页面轮询获取命令
  if (req.method === 'GET' && url === '/api/command') {
    const cmd = commandStore.get(ip);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 返回命令并清除（一次性）
    if (cmd) {
      commandStore.delete(ip);
      res.end(JSON.stringify(cmd));
    } else {
      res.end(JSON.stringify({ cmd: null }));
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
      lastUpdate: location?.timestamp || null
    }));
    return;
  }
  
  // ==================== 小豆端 API ====================
  
  // POST /api/refresh - 小豆主动刷新用户位置
  if (req.method === 'POST' && url === '/api/refresh') {
    try {
      const body = JSON.parse(req.body || '{}');
      const targetIP = body.ip;
      
      if (targetIP) {
        commandStore.set(targetIP, { 
          cmd: 'refresh', 
          timestamp: new Date().toISOString() 
        });
      } else {
        // 如果没有指定IP，设置全局刷新（下次轮询时生效）
        // 页面会检查所有IP，但这里简化处理
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          success: false, 
          message: '需要指定用户IP' 
        }));
        return;
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        success: true, 
        message: `已向 ${targetIP} 发送刷新指令` 
      }));
      return;
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false }));
      return;
    }
  }
  
  // GET /api/my-ip - 获取自己的IP
  if (req.method === 'GET' && url === '/api/my-ip') {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(ip);
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
        .status.refreshing { background: #cce5ff; color: #004085; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
        .location-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; display: none; }
        .location-box.show { display: block; }
        .coord { font-family: monospace; font-size: 16px; color: #333; margin: 8px 0; }
        .info { font-size: 12px; color: #666; margin-top: 15px; }
        .heartbeat { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px; font-size: 14px; color: #666; }
        .heart { color: #dc3545; font-size: 20px; }
        .heart.beating { animation: beat 1s infinite; }
        @keyframes beat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        .footer { margin-top: 30px; font-size: 12px; color: #999; }
        .refresh-notice { display: none; color: #004085; font-size: 14px; margin-top: 10px; }
        .refresh-notice.show { display: block; }
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
        
        <div id="refreshNotice" class="refresh-notice">🔄 小豆正在请求位置...</div>
        
        <div id="heartbeat" class="heartbeat">
            <span class="heart" id="heartIcon">♥</span>
            <span id="heartbeatText">连接中...</span>
        </div>
        
        <div class="footer">页面保持后台运行即可 · 无需任何操作</div>
    </div>
    
    <script>
        let loc = null;
        let lastUpload = null;
        let heartbeatInterval = null;
        let commandInterval = null;
        
        const HEARTBEAT_INTERVAL = 900000; // 15分钟刷新一次位置
        const COMMAND_CHECK_INTERVAL = 5000; // 每5秒检查一次命令
        
        function updateStatus(text, className) {
            document.getElementById('status').textContent = text;
            document.getElementById('status').className = 'status ' + className;
        }
        
        function getLocation() {
            if (!navigator.geolocation) {
                updateStatus('浏览器不支持定位', 'error');
                return Promise.reject('不支持');
            }
            
            return new Promise((resolve, reject) => {
                updateStatus('获取中...', 'getting');
                navigator.geolocation.getCurrentPosition((p) => {
                    loc = p.coords;
                    document.getElementById('lat').textContent = loc.latitude.toFixed(6);
                    document.getElementById('lng').textContent = loc.longitude.toFixed(6);
                    document.getElementById('acc').textContent = Math.round(loc.accuracy);
                    
                    updateStatus('✓ 定位已同步', 'online');
                    document.getElementById('locationBox').className = 'location-box show';
                    
                    uploadLocation().then(() => resolve()).catch(() => resolve());
                }, (e) => {
                    let msg = '定位失败';
                    if (e.code === 1) msg = '请允许定位权限';
                    else if (e.code === 2) msg = '定位服务不可用';
                    updateStatus(msg, 'error');
                    reject(msg);
                }, { timeout: 10000 });
            });
        }
        
        function uploadLocation() {
            if (!loc) return Promise.reject('无位置');
            
            return fetch('/api/location', {
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
                return data;
            });
        }
        
        function checkCommand() {
            fetch('/api/command').then(r => r.json()).then(data => {
                if (data.cmd === 'refresh') {
                    console.log('收到刷新指令，立即刷新位置');
                    document.getElementById('refreshNotice').className = 'refresh-notice show';
                    updateStatus('🔄 小豆请求位置...', 'refreshing');
                    getLocation().then(() => {
                        document.getElementById('refreshNotice').className = 'refresh-notice';
                    });
                }
            }).catch(() => {});
        }
        
        function startHeartbeat() {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            
            const heartIcon = document.getElementById('heartIcon');
            heartIcon.classList.add('beating');
            
            heartbeatInterval = setInterval(() => {
                getLocation().catch(() => {});
            }, HEARTBEAT_INTERVAL);
            
            updateStatus('✓ 实时同步中', 'online');
        }
        
        function startCommandCheck() {
            if (commandInterval) clearInterval(commandInterval);
            
            commandInterval = setInterval(checkCommand, COMMAND_CHECK_INTERVAL);
        }
        
        // 页面可见性变化时保持运行
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                getLocation();
            }
        });
        
        window.onload = () => {
            getLocation().then(() => {
                startHeartbeat();
                startCommandCheck();
            });
        };
        
        window.onunload = () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (commandInterval) clearInterval(commandInterval);
        };
    </script>
</body>
</html>`;
}
