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
    console.log(`Library: http://localhost:${PORT}/library.html`);
    console.log(`Reader: http://localhost:${PORT}/reader.html`);
    console.log(`Editor: http://localhost:${PORT}/editor.html`);
    console.log(`API: http://localhost:${PORT}/api/sheets`);
    console.log('');
    console.log('Press Ctrl+C to stop server');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use.`);
        console.log('Please close other instances or use a different port.');
        console.log('');
        console.log('Opening static file mode instead...');

        // 嘗試開啟靜態檔案
        exec('start "" "library.html"', (error) => {
            if (error) {
                console.log('Please manually open library.html');
            }
        });
    } else {
        console.error('Server error:', err);
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
