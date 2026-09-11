const http = require('http');
const { handleRequest } = require('./server/routes.js');
const store = require('./server/sheet-store.js');
const { migrateIfEmpty } = require('./server/migrate.js');

const PORT = process.env.PORT || 3001;

store.openDatabase();
const migrated = migrateIfEmpty();

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`Guitar Sheet Server Started`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Library: http://localhost:${PORT}/index.html`);
    console.log(`Reader: http://localhost:${PORT}/reader.html`);
    console.log(`Editor: http://localhost:${PORT}/editor.html`);
    console.log(`API: http://localhost:${PORT}/api/sheets`);
    console.log(`Database: ${store.getDbPath()}`);
    if (migrated && !migrated.skipped && migrated.imported > 0) {
        console.log(`Migrated ${migrated.imported} sheets from folders`);
    }
    console.log('');
    console.log('按下 Ctrl+C 可停止伺服器');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`埠號 ${PORT} 已被佔用。`);
        console.log('請關閉其他執行中的實例或改用其他埠號。');
        console.log('');
    } else {
        console.error('伺服器錯誤:', err);
    }
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n正在關閉服務器...');
    server.close(() => {
        store.closeDatabase();
        console.log('服務器已關閉');
        process.exit(0);
    });
});
