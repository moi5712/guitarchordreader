const url = require('url');
const fs = require('fs');
const path = require('path');
const { handleImportFromUrl } = require('../importer/url-importer.js');
const api = require('./api.js');

// 支援環境變數（Electron 桌面版可設為 userData/bookmarks.json）
const bookmarksFilePath = process.env.BOOKMARKS_FILE || path.join(__dirname, '..', '..', 'bookmarks.json');
const sheetsDir = process.env.SHEETS_DIR || path.join(__dirname, '..', '..', 'sheets');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.txt': 'text/plain',
    '.gtab': 'text/plain',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
};

function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // 直接處理根目錄，導向 index.html
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
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
        const result = api.getSheetsData(sheetsDir, bookmarksFilePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
        return;
    }

    // API 端點：更新書籤
    if (pathname === '/api/bookmark' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { filename, bookmarked } = JSON.parse(body);
                api.setBookmark(bookmarksFilePath, filename, bookmarked);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: '書籤更新成功' }));
            } catch (error) {
                console.error('更新書籤失敗:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
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
                api.saveSheet(sheetsDir, filename, content);
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

    // API 端點：從樂譜庫刪除檔案
    if (pathname === '/api/delete-sheet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { filename } = JSON.parse(body);
                api.deleteSheet(sheetsDir, filename);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: '已從樂譜庫刪除' }));
            } catch (error) {
                const code = error.message === '缺少檔名' ? 400 : error.message === '檔名不合法' || error.message === '路徑不合法' ? 400 : error.message === '檔案不存在' ? 404 : 500;
                res.writeHead(code, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
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
    const safePath = decodeURIComponent(pathname).replace(/^\/+/, '');
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
