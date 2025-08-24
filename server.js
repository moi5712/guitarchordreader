const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const SHEETS_DIR = path.join(__dirname, 'sheets');

// MIME 類型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.gtab': 'text/plain'
};

// 解析樂譜 meta 資訊
function parseSheetMeta(content) {
    const meta = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            const match = trimmed.match(/^#(\w+):\s*(.*)$/);
            if (match) {
                meta[match[1]] = match[2];
            }
        } else {
            break; // 遇到非 meta 行就停止
        }
    }
    
    return meta;
}

// 掃描樂譜文件夾
function scanSheetsFolder() {
    try {
        const files = fs.readdirSync(SHEETS_DIR);
        const sheets = [];
        
        for (const filename of files) {
            if (filename.endsWith('.txt') || filename.endsWith('.gtab')) {
                const filePath = path.join(SHEETS_DIR, filename);
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                const meta = parseSheetMeta(content);
                
                sheets.push({
                    filename: filename,
                    title: meta.title || path.parse(filename).name,
                    artist: meta.artist || '',
                    key: meta.key || '',
                    bpm: meta.bpm || '',
                    capo: meta.capo || '',
                    content: content,
                    lastModified: stats.mtime.getTime(),
                    size: stats.size
                });
            }
        }
        
        // 按檔案名排序
        sheets.sort((a, b) => a.filename.localeCompare(b.filename));
        
        return {
            success: true,
            count: sheets.length,
            sheets: sheets
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            sheets: []
        };
    }
}

// 創建 HTTP 服務器
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // 根路徑重定向到首頁（改為 library.html）
    if (pathname === '/') {
        pathname = '/library.html';
    }
    
    // 設置 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 處理 OPTIONS 請求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API 端點：獲取樂譜列表
    if (pathname === '/api/sheets') {
        const result = scanSheetsFolder();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
        return;
    }

    // API 端點：儲存樂譜
    if (pathname === '/api/save-sheet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { filename, content } = JSON.parse(body);
                const filePath = path.join(__dirname, 'sheets', filename);

                fs.writeFileSync(filePath, content, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: '檔案儲存成功'
                }));
            } catch (error) {
                console.error('儲存檔案失敗:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });
        return;
    }
    
    // 靜態文件服務（修正Windows上以/開頭導致成為絕對路徑的問題）
    const safePath = pathname === '/' ? 'library.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    let filePath = path.join(__dirname, safePath);
    
    // 安全檢查：防止目錄遍歷攻擊
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    // 檢查文件是否存在
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        // 獲取文件擴展名
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        // 讀取並返回文件
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Internal server error');
                return;
            }
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

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
        const { exec } = require('child_process');
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

// 優雅關閉
process.on('SIGINT', () => {
    console.log('\n正在關閉服務器...');
    server.close(() => {
        console.log('服務器已關閉');
        process.exit(0);
    });
});
