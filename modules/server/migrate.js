/**
 * 將既有 sheets 資料夾與 bookmarks.json 匯入 SQLite。
 */

const fs = require('fs');
const path = require('path');
const store = require('./sheet-store.js');
const { scanSheetsFolder } = require('./sheet-service.js');

function projectRoot() {
    return path.join(__dirname, '..', '..');
}

function defaultSources() {
    const root = projectRoot();
    const sources = [
        {
            sheetsDir: path.join(root, 'sheets'),
            bookmarksFile: path.join(root, 'bookmarks.json'),
        },
    ];
    const appData = process.env.APPDATA || '';
    if (appData) {
        const electronRoot = path.join(appData, 'guitar-sheet-reader-editor');
        sources.push({
            sheetsDir: path.join(electronRoot, 'sheets'),
            bookmarksFile: path.join(electronRoot, 'bookmarks.json'),
        });
    }
    return sources;
}

function importBookmarksFile(bookmarksFile) {
    if (!bookmarksFile || !fs.existsSync(bookmarksFile)) return 0;
    let list = [];
    try {
        list = JSON.parse(fs.readFileSync(bookmarksFile, 'utf8'));
        if (!Array.isArray(list)) list = [];
    } catch (error) {
        console.error('讀取書籤失敗:', bookmarksFile, error.message);
        return 0;
    }
    let count = 0;
    for (const filename of list) {
        if (typeof filename !== 'string') continue;
        if (!store.getSheet(filename)) continue;
        store.setBookmark(filename, true);
        count++;
    }
    return count;
}

/**
 * 從單一資料夾匯入樂譜（及可選的 bookmarks.json）。
 * @returns {{ imported: number, bookmarks: number }}
 */
function importFromFolder(sheetsDir, bookmarksFile) {
    let imported = 0;
    let bookmarks = 0;
    if (sheetsDir && fs.existsSync(sheetsDir)) {
        const result = scanSheetsFolder(sheetsDir);
        for (const sheet of result.sheets || []) {
            try {
                store.saveSheet(sheet.filename, sheet.content, {
                    lastModified: sheet.lastModified,
                    addedDate: sheet.lastModified,
                });
                imported++;
            } catch (error) {
                console.error('匯入樂譜失敗:', sheet.filename, error.message);
            }
        }
    }
    if (bookmarksFile) {
        bookmarks = importBookmarksFile(bookmarksFile);
    } else if (sheetsDir) {
        bookmarks = importBookmarksFile(path.join(sheetsDir, 'bookmarks.json'))
            || importBookmarksFile(path.join(path.dirname(sheetsDir), 'bookmarks.json'));
    }
    return { imported, bookmarks };
}

function migrateAll(options = {}) {
    store.openDatabase(options.dbPath);
    const sources = [...defaultSources(), ...(options.extraSources || [])];
    const seenDirs = new Set();
    let imported = 0;
    let bookmarks = 0;
    for (const source of sources) {
        const dir = source.sheetsDir ? path.resolve(source.sheetsDir) : '';
        if (dir && seenDirs.has(dir)) continue;
        if (dir) seenDirs.add(dir);
        const result = importFromFolder(source.sheetsDir, source.bookmarksFile);
        imported += result.imported;
        bookmarks += result.bookmarks;
    }
    return { imported, bookmarks };
}

function migrateIfEmpty(options = {}) {
    store.openDatabase(options.dbPath);
    if (store.sheetCount() > 0) {
        return { imported: 0, bookmarks: 0, skipped: true };
    }
    return migrateAll(options);
}

module.exports = {
    defaultSources,
    importFromFolder,
    migrateAll,
    migrateIfEmpty,
};
