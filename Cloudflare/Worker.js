export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/upload_qr' && request.method === 'POST') {
      return handleUpload(request, env);
    }

    if (url.pathname === '/qr_data' && request.method === 'GET') {
      return handleGetData(request, env);
    }

    if (url.pathname === '/') {
      return new Response(getHtml(), {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
        },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};

/**
 * 处理上传请求，将数据写入 D1 数据库
 * @param {Request} request
 * @param {object} env
 */
async function handleUpload(request, env) {
  try {
    const body = await request.json();
    const qrData = body.data;

    if (!qrData) {
      return new Response('No data provided', { status: 400 });
    }

    // 准备 SQL 语句以插入新数据
    const stmt = env.DB.prepare('INSERT INTO qr_codes (data) VALUES (?)');
    await stmt.bind(qrData).run();

    return new Response('Data received and stored in D1', { status: 200 });
  } catch (error) {
    console.error('Error handling upload:', error);
    // 检查是否为 JSON 解析错误
    if (error instanceof SyntaxError) {
      return new Response('Invalid JSON format', { status: 400 });
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * 处理数据获取请求，从 D1 数据库读取数据
 * @param {Request} request
 * @param {object} env
 */
async function handleGetData(request, env) {
  try {
    // 查询最新的 QR 码记录
    const latestQrStmt = env.DB.prepare('SELECT data, timestamp FROM qr_codes ORDER BY timestamp DESC LIMIT 1');
    const latestQrResult = await latestQrStmt.first();

    // 查询最近 5 条更新记录作为日志
    const logStmt = env.DB.prepare('SELECT data, timestamp FROM qr_codes ORDER BY timestamp DESC LIMIT 5');
    const logResult = await logStmt.all();

    const data = {
      current_qr: latestQrResult ? latestQrResult.data : 'Waiting for QR code...',
      last_updated: latestQrResult ? latestQrResult.timestamp : 'N/A',
      update_log: logResult.results || [],
    };

    return new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // 允许 CORS 以便测试
      },
    });
  } catch (error) {
    console.error('Error fetching data from D1:', error);
    return new Response('Error fetching data', { status: 500 });
  }
}

/**
 * 返回前端展示页面的 HTML
 * @returns {string}
 */
function getHtml() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <title>Real-time QR Code Display (D1 Version)</title>
      <style>
          body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f0f0f0;
              font-family: sans-serif;
          }
          #container {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
          }
          #qrcode {
              padding: 20px;
              background-color: white;
              border-radius: 10px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          #info {
              text-align: center;
          }
          #log {
              margin-top: 10px;
              padding: 10px;
              border: 1px solid #ccc;
              border-radius: 5px;
              max-height: 150px;
              overflow-y: auto;
              width: 400px;
              background-color: #fff;
          }
          #log p {
            margin: 5px 0;
            font-size: 14px;
          }
      </style>
  </head>
  <body>
  
  <div id="container">
      <div id="qrcode"></div>
      <div id="info">
          <p>Last Updated: <span id="last-updated">N/A</span></p>
          <h3>Update Log</h3>
          <div id="log"></div>
      </div>
  </div>
  
  <script src="https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js"></script>
  <script>
      const qrcodeContainer = document.getElementById('qrcode');
      const lastUpdatedElem = document.getElementById('last-updated');
      const logElem = document.getElementById('log');
      let currentQRData = "";
  
      let qrcode = new QRCode(qrcodeContainer, {
          text: "Waiting for QR code...",
          width: 400,
          height: 400,
          colorDark : "#000000",
          colorLight : "#ffffff",
          correctLevel : QRCode.CorrectLevel.H
      });
  
      async function fetchQRData() {
          try {
              const response = await fetch('/qr_data');
              if (!response.ok) {
                  throw new Error('Network response was not ok');
              }
              const data = await response.json();
  
              if (data.current_qr && data.current_qr !== currentQRData) {
                  currentQRData = data.current_qr;
                  qrcode.clear();
                  qrcode.makeCode(currentQRData);
              }
  
              lastUpdatedElem.textContent = data.last_updated !== 'N/A' ? new Date(data.last_updated).toLocaleString() : 'N/A';
  
              logElem.innerHTML = '';
              if (data.update_log && data.update_log.length > 0) {
                data.update_log.forEach(entry => {
                    const p = document.createElement('p');
                    const shortData = entry.data.length > 30 ? entry.data.substring(0, 30) + '...' : entry.data;
                    // D1 返回的时间戳可能需要正确解析
                    const timestamp = entry.timestamp.endsWith('Z') ? entry.timestamp : entry.timestamp + 'Z';
                    p.textContent = \`[\${new Date(timestamp).toLocaleString()}] - \${shortData}\`;
                    logElem.appendChild(p);
                });
              } else {
                logElem.innerHTML = '<p>No updates logged yet.</p>';
              }
  
          } catch (error) {
              console.error('Error fetching QR data:', error);
          }
      }
  
      // 每 1 秒获取一次数据
      setInterval(fetchQRData, 1000);
      // 初始加载
      fetchQRData();
  </script>
  
  </body>
  </html>
  `;
}