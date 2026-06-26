/**
 * 後端 API 邏輯抽離，供 HTTP routes 與 Electron main process 共用。
 * 所有函式接受 sheetsDir 與 bookmarksPath，不依賴 process.env 在呼叫當下的值。
 */

const fs = require('fs');
const path = require('path');
const { scanSheetsFolder } = require('./sheet-service.js');
const { importFromUrlUrls } = require('../importer/url-importer.js');

function getBookmarks(bookmarksPath) {
    try {
        if (fs.existsSync(bookmarksPath)) {
            const data = fs.readFileSync(bookmarksPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading bookmarks file:', error);
    }
    return [];
}

function saveBookmarks(bookmarksPath, bookmarks) {
    try {
        const dir = path.dirname(bookmarksPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarks, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing bookmarks file:', error);
        throw error;
    }
}

/**
 * @param {string} sheetsDir
 * @param {string} bookmarksPath
 * @returns {{ success: boolean, count: number, sheets: Array }}
 */
function getSheetsData(sheetsDir, bookmarksPath) {
    const bookmarks = getBookmarks(bookmarksPath);
    const result = scanSheetsFolder(sheetsDir);
    if (!result.sheets) result.sheets = [];
    result.sheets = result.sheets.map(sheet => ({
        ...sheet,
        bookmarked: bookmarks.includes(sheet.filename)
    }));
    return result;
}

/**
 * @param {string} bookmarksPath
 * @param {string} filename
 * @param {boolean} bookmarked
 */
function setBookmark(bookmarksPath, filename, bookmarked) {
    let bookmarks = getBookmarks(bookmarksPath);
    if (bookmarked) {
        if (!bookmarks.includes(filename)) bookmarks.push(filename);
    } else {
        bookmarks = bookmarks.filter(b => b !== filename);
    }
    saveBookmarks(bookmarksPath, bookmarks);
}

/**
 * @param {string} sheetsDir
 * @param {string} filename
 * @param {string} content
 */
function saveSheet(sheetsDir, filename, content) {
    if (!fs.existsSync(sheetsDir)) {
        fs.mkdirSync(sheetsDir, { recursive: true });
    }
    const base = path.basename(filename);
    if (base !== filename || (!base.endsWith('.txt') && !base.endsWith('.gtab'))) {
        throw new Error('檔名不合法');
    }
    const filePath = path.join(sheetsDir, base);
    fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * @param {string} sheetsDir
 * @param {string} filename
 */
function deleteSheet(sheetsDir, filename) {
    if (!filename || typeof filename !== 'string') {
        throw new Error('缺少檔名');
    }
    const base = path.basename(filename);
    if (base !== filename || (!base.endsWith('.txt') && !base.endsWith('.gtab'))) {
        throw new Error('檔名不合法');
    }
    const filePath = path.join(sheetsDir, base);
    const realSheets = fs.realpathSync(sheetsDir);
    const realFile = path.resolve(sheetsDir, base);
    if (!realFile.startsWith(realSheets)) {
        throw new Error('路徑不合法');
    }
    if (!fs.existsSync(filePath)) {
        throw new Error('檔案不存在');
    }
    fs.unlinkSync(filePath);
}

/**
 * @param {string} sheetsDir
 * @param {string[]} urls
 * @returns {Promise<{ success: boolean, processed: number, results: Array }>}
 */
async function importFromUrl(sheetsDir, urls) {
    return importFromUrlUrls(sheetsDir, urls);
}

module.exports = {
    getBookmarks,
    saveBookmarks,
    getSheetsData,
    setBookmark,
    saveSheet,
    deleteSheet,
    importFromUrl
};
