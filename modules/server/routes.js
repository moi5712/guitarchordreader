const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { scanSheetsFolder } = require('./sheet-service.js');
const { handleImportFromUrl } = require('../importer/url-importer.js'); // Added this line

const bookmarksFilePath = path.join(__dirname, '..', '..', 'bookmarks.json');

// Helper functions for bookmarks
function getBookmarks() {
    try {
        if (fs.existsSync(bookmarksFilePath)) {
            const data = fs.readFileSync(bookmarksFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading bookmarks file:', error);
    }
    return [];
}

function saveBookmarks(bookmarks) {
    try {
        fs.writeFileSync(bookmarksFilePath, JSON.stringify(bookmarks, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing bookmarks file:', error);
    }
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.gtab': 'text/plain',
    '.svg': 'image/svg+xml'
};

function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    const uChordPrefix = '/u-chord';

    // Redirect root '/' to the namespaced '/u-chord/'
    if (pathname === '/') {
        res.writeHead(302, { 'Location': uChordPrefix + '/' });
        res.end();
        return;
    }

    // If the path is part of the u-chord namespace, strip the prefix
    if (pathname.startsWith(uChordPrefix)) {
        pathname = pathname.substring(uChordPrefix.length);
        // If we are left with an empty path, it's the root of the namespace, serve index.html
        if (pathname === '' || pathname === '/') {
            pathname = '/index.html';
        }
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
        const bookmarks = getBookmarks();
        const result = scanSheetsFolder();
        // Add bookmark status to each sheet
        const sheetsWithBookmarks = result.sheets.map(sheet => ({
            ...sheet,
            bookmarked: bookmarks.includes(sheet.filename)
        }));
        result.sheets = sheetsWithBookmarks;
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
                let bookmarks = getBookmarks();

                if (bookmarked) {
                    if (!bookmarks.includes(filename)) {
                        bookmarks.push(filename);
                    }
                } else {
                    bookmarks = bookmarks.filter(b => b !== filename);
                }

                saveBookmarks(bookmarks);

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
