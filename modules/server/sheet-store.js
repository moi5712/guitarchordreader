/**
 * SQLite 樂譜儲存層。HTTP 與 Electron 共用。
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { parseSheetMeta } = require('./sheet-service.js');

let db = null;
let dbPath = null;

function getDefaultDbPath() {
    return process.env.SHEETS_DB || path.join(__dirname, '..', '..', 'data', 'sheets.db');
}

function getDbPath() {
    return dbPath || getDefaultDbPath();
}

function openDatabase(filePath) {
    const resolved = path.resolve(filePath || getDefaultDbPath());
    if (db && dbPath === resolved) return db;
    if (db) {
        try { db.close(); } catch (_) { /* ignore */ }
        db = null;
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    db = new Database(resolved);
    db.pragma('journal_mode = WAL');
    db.exec(`
        CREATE TABLE IF NOT EXISTS sheets (
            filename TEXT PRIMARY KEY,
            title TEXT,
            artist TEXT,
            key TEXT,
            bpm TEXT,
            capo TEXT,
            tags TEXT,
            image TEXT,
            content TEXT NOT NULL,
            last_modified INTEGER,
            added_date INTEGER,
            size INTEGER
        );
        CREATE TABLE IF NOT EXISTS bookmarks (
            filename TEXT PRIMARY KEY
        );
    `);
    dbPath = resolved;
    return db;
}

function getDb() {
    return db || openDatabase();
}

function assertValidFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        throw new Error('缺少檔名');
    }
    const base = path.basename(filename.trim());
    if (base !== filename.trim() || (!base.endsWith('.txt') && !base.endsWith('.gtab'))) {
        throw new Error('檔名不合法');
    }
    return base;
}

function rowToSheet(row, bookmarked) {
    let tags = [];
    try {
        tags = JSON.parse(row.tags || '[]');
        if (!Array.isArray(tags)) tags = [];
    } catch (_) {
        tags = [];
    }
    return {
        filename: row.filename,
        title: row.title || '',
        artist: row.artist || '',
        key: row.key || '',
        bpm: row.bpm || '',
        capo: row.capo || '',
        tags,
        image: row.image || '',
        content: row.content,
        lastModified: row.last_modified,
        addedDate: row.added_date,
        size: row.size,
        bookmarked: !!bookmarked
    };
}

function sheetCount() {
    return getDb().prepare('SELECT COUNT(*) AS c FROM sheets').get().c;
}

function listSheets() {
    const database = getDb();
    const bookmarkSet = new Set(
        database.prepare('SELECT filename FROM bookmarks').all().map((r) => r.filename)
    );
    const rows = database.prepare('SELECT * FROM sheets ORDER BY filename COLLATE NOCASE').all();
    const sheets = rows.map((row) => rowToSheet(row, bookmarkSet.has(row.filename)));
    return {
        success: true,
        count: sheets.length,
        sheets
    };
}

function getSheet(filename) {
    const row = getDb().prepare('SELECT * FROM sheets WHERE filename = ?').get(filename);
    if (!row) return null;
    const bookmarked = !!getDb().prepare('SELECT 1 FROM bookmarks WHERE filename = ?').get(filename);
    return rowToSheet(row, bookmarked);
}

function saveSheet(filename, content, options = {}) {
    const base = assertValidFilename(filename);
    if (typeof content !== 'string') {
        throw new Error('缺少樂譜內容');
    }
    const meta = parseSheetMeta(content);
    const now = Date.now();
    const database = getDb();
    const existing = database.prepare('SELECT added_date FROM sheets WHERE filename = ?').get(base);
    const addedDate = existing
        ? existing.added_date
        : (options.addedDate || now);
    const lastModified = options.lastModified || now;
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    database.prepare(`
        INSERT INTO sheets (
            filename, title, artist, key, bpm, capo, tags, image,
            content, last_modified, added_date, size
        ) VALUES (
            @filename, @title, @artist, @key, @bpm, @capo, @tags, @image,
            @content, @last_modified, @added_date, @size
        )
        ON CONFLICT(filename) DO UPDATE SET
            title = excluded.title,
            artist = excluded.artist,
            key = excluded.key,
            bpm = excluded.bpm,
            capo = excluded.capo,
            tags = excluded.tags,
            image = excluded.image,
            content = excluded.content,
            last_modified = excluded.last_modified,
            size = excluded.size
    `).run({
        filename: base,
        title: meta.title || path.parse(base).name,
        artist: meta.artist || '',
        key: meta.key || '',
        bpm: meta.bpm || '',
        capo: meta.capo || '',
        tags: JSON.stringify(tags),
        image: meta.image || '',
        content,
        last_modified: lastModified,
        added_date: addedDate,
        size: Buffer.byteLength(content, 'utf8')
    });
    return base;
}

function deleteSheet(filename) {
    const base = assertValidFilename(filename);
    const database = getDb();
    const info = database.prepare('DELETE FROM sheets WHERE filename = ?').run(base);
    if (info.changes === 0) {
        throw new Error('檔案不存在');
    }
    database.prepare('DELETE FROM bookmarks WHERE filename = ?').run(base);
}

function getBookmarks() {
    return getDb().prepare('SELECT filename FROM bookmarks ORDER BY filename').all().map((r) => r.filename);
}

function setBookmark(filename, bookmarked) {
    if (!filename || typeof filename !== 'string') {
        throw new Error('缺少檔名');
    }
    const database = getDb();
    if (bookmarked) {
        database.prepare('INSERT OR IGNORE INTO bookmarks (filename) VALUES (?)').run(filename);
    } else {
        database.prepare('DELETE FROM bookmarks WHERE filename = ?').run(filename);
    }
}

function closeDatabase() {
    if (db) {
        try { db.close(); } catch (_) { /* ignore */ }
        db = null;
        dbPath = null;
    }
}

module.exports = {
    getDefaultDbPath,
    getDbPath,
    openDatabase,
    sheetCount,
    listSheets,
    getSheet,
    saveSheet,
    deleteSheet,
    getBookmarks,
    setBookmark,
    closeDatabase,
    assertValidFilename
};
