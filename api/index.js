const http = require('http');
const fs = require('fs');

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
        h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
        .status { padding: 15px 25px; border-radius: 50px; display: inline-block; margin: 20px 0; font-weight: 600; font-size: 14px; }
        .status.waiting { background: #fff3cd; color: #856404; }
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .location-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; display: none; }
        .location-box.show { display: block; }
        .coord { font-family: monospace; font-size: 14px; color: #333; margin: 5px 0; }
        .btn { background: #667eea; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #5568d3; }
        .share-btn { background: #28a745; margin-top: 15px; }
        .share-btn:hover { background: #218838; }
        .copy-msg { font-size: 12px; color: #28a745; margin-top: 5px; display: none; }
        .copy-msg.show { display: block; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; }
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
            <button class="btn share-btn" onclick="copyLocation()">📋 复制位置</button>
            <div id="copyMsg" class="copy-msg">已复制！可以粘贴给雷小豆了。</div>
        </div>
        <div class="footer">定位仅供本次使用</div>
    </div>
    <script>
        let loc = null;
        function getLocation() {
            const s = document.getElementById('status');
            if (!navigator.geolocation) { s.textContent = '不支持'; s.className = 'status error'; return; }
            s.textContent = '获取中...'; s.className = 'status waiting';
            navigator.geolocation.getCurrentPosition((p) => {
                loc = p.coords;
                document.getElementById('lat').textContent = loc.latitude.toFixed(6);
                document.getElementById('lng').textContent = loc.longitude.toFixed(6);
                s.textContent = '✓ 成功'; s.className = 'status success';
                document.getElementById('locationBox').className = 'location-box show';
                document.getElementById('shareSection').style.display = 'block';
            }, (e) => { s.textContent = e.code === 1 ? '请允许定位' : '定位失败'; s.className = 'status error'; }, {timeout:30000});
        }
        function copyLocation() {
            if (!loc) return;
            const t = '我的位置：纬度 ' + loc.latitude.toFixed(6) + '，经度 ' + loc.longitude.toFixed(6);
            navigator.clipboard.writeText(t).then(() => { document.getElementById('copyMsg').className = 'copy-msg show'; });
        }
        window.onload = getLocation;
    </script>
</body>
</html>`;

module.exports = (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(HTML);
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
};
