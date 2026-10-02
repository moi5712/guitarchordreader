/**
 * 後端 API 邏輯抽離，供 HTTP routes 與 Electron main process 共用。
 * 樂譜與書籤皆存於 SQLite（sheet-store）。
 */

const store = require('./sheet-store.js');
const { importFromUrlUrls } = require('../importer/url-importer.js');
const { importFromFolder } = require('./migrate.js');

function getBookmarks() {
    return store.getBookmarks();
}

function getSheetsData() {
    return store.listSheets();
}

function getSheetData(filename) {
    const sheet = store.getSheet(filename);
    if (!sheet) {
        const error = new Error('檔案不存在');
        error.statusCode = 404;
        throw error;
    }
    return { success: true, sheet };
}

function setBookmark(filename, bookmarked) {
    store.setBookmark(filename, bookmarked);
}

function saveSheet(filename, content, options) {
    return store.saveSheet(filename, content, options);
}

function deleteSheet(filename) {
    store.deleteSheet(filename);
}

/**
 * @param {string[]} urls
 * @returns {Promise<{ success: boolean, processed: number, results: Array }>}
 */
async function importFromUrl(urls) {
    return importFromUrlUrls(urls);
}

function importFolder(sheetsDir, bookmarksFile) {
    return importFromFolder(sheetsDir, bookmarksFile);
}

module.exports = {
    getBookmarks,
    getSheetsData,
    getSheetData,
    setBookmark,
    saveSheet,
    deleteSheet,
    importFromUrl,
    importFolder
};
