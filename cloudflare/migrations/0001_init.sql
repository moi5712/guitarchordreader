-- 樂譜庫結構，與本機 modules/server/sheet-store.js 的 SQLite schema 一致
CREATE TABLE IF NOT EXISTS sheets (
    filename TEXT PRIMARY KEY,
    title TEXT,
    artist TEXT,
    "key" TEXT,
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
