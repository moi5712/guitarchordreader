const http = require('http');
const { exec } = require('child_process');
const { handleRequest } = require('./server/routes.js');

const PORT = 3000;

// 創建 HTTP 服務器
const server = http.createServer(handleRequest);

// 啟動服務器
server.listen(PORT, () => {
    console.log(`Guitar Sheet Server Started`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Library: http://localhost:${PORT}/index.html`);
    console.log(`Reader: http://localhost:${PORT}/reader.html`);
    console.log(`Editor: http://localhost:${PORT}/editor.html`);
    console.log(`API: http://localhost:${PORT}/api/sheets`);
    console.log('');
    console.log('按下 Ctrl+C 可停止伺服器');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`埠號 ${PORT} 已被佔用。`);
        console.log('請關閉其他執行中的實例或改用其他埠號。');
        console.log('');
        // 不再自動開啟靜態檔案
    } else {
        console.error('伺服器錯誤:', err);
    }
    process.exit(1);
});

// 關閉服務器
process.on('SIGINT', () => {
    console.log('\n正在關閉服務器...');
    server.close(() => {
        console.log('服務器已關閉');
        process.exit(0);
    });
});
