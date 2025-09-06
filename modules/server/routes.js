const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { scanSheetsFolder } = require('./sheet-service.js');
const { handleImportFromUrl } = require('../importer/url-importer.js'); // Added this line

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.gtab': 'text/plain'
};

function handleRequest(req, res) {
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
                const filePath = path.join(__dirname, '..', '..', 'sheets', filename);

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

    // API 端點：從URL導入
    if (pathname === '/api/import-from-url' && req.method === 'POST') {
        handleImportFromUrl(req, res);
        return;
    }

    // 靜態文件服務
    const safePath = pathname === '/' ? 'library.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    let filePath = path.join(__dirname, '..', '..', safePath);

    // 安全檢查：防止目錄遍歷攻擊
    if (!filePath.startsWith(path.join(__dirname, '..', '..'))) {
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
}

module.exports = {
    handleRequest
};
