/**
 * Cloudflare Worker：線上版樂譜庫。
 *
 * 靜態網站由 assets 綁定直接提供，這裡只處理 /api/*，
 * 並以 D1 取代本機的 better-sqlite3（modules/server/sheet-store.js）。
 * API 介面與本機 Node 伺服器一致，前端不需要改動。
 */

import { importFromUrls } from './ufret.js';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
    });
}

function normalizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        throw new ApiError(400, '缺少檔名');
    }
    const base = filename.trim();
    if (!base || base.startsWith('.') || /[\\/]/.test(base) || !/\.(txt|gtab)$/i.test(base)) {
        throw new ApiError(400, '檔名不合法');
    }
    return base;
}

/** 與 modules/server/sheet-service.js 的 parseSheetMeta 相同 */
function parseSheetMeta(content) {
    const meta = {};
    for (const line of String(content || '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith('#') && !trimmed.startsWith('@')) break;

        if (trimmed.startsWith('#')) {
            const match = trimmed.match(/^#(\w+):\s*(.*)$/);
            if (match) {
                if (match[1] === 'tags') {
                    meta.tags = match[2].split(',').map((tag) => tag.trim()).filter(Boolean);
                } else {
                    meta[match[1]] = match[2];
                }
            }
        } else {
            const match = trimmed.match(/^@image[:=]\s*(.*)$/);
            if (match) meta.image = match[1].trim();
        }
    }
    return meta;
}

function rowToSheet(row, bookmarked) {
    let tags = [];
    try {
        const parsed = JSON.parse(row.tags || '[]');
        if (Array.isArray(parsed)) tags = parsed;
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
        bookmarked: !!bookmarked,
    };
}

async function listSheets(db) {
    const [sheetRows, bookmarkRows] = await db.batch([
        db.prepare('SELECT * FROM sheets ORDER BY filename COLLATE NOCASE'),
        db.prepare('SELECT filename FROM bookmarks'),
    ]);
    const bookmarked = new Set((bookmarkRows.results || []).map((r) => r.filename));
    const sheets = (sheetRows.results || []).map((row) => rowToSheet(row, bookmarked.has(row.filename)));
    return { success: true, count: sheets.length, sheets };
}

export async function saveSheet(db, filename, content) {
    const base = normalizeFilename(filename);
    if (typeof content !== 'string') {
        throw new ApiError(400, '缺少樂譜內容');
    }
    const meta = parseSheetMeta(content);
    const now = Date.now();
    const existing = await db.prepare('SELECT added_date FROM sheets WHERE filename = ?').bind(base).first();

    await db.prepare(`
        INSERT INTO sheets (
            filename, title, artist, "key", bpm, capo, tags, image,
            content, last_modified, added_date, size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET
            title = excluded.title,
            artist = excluded.artist,
            "key" = excluded."key",
            bpm = excluded.bpm,
            capo = excluded.capo,
            tags = excluded.tags,
            image = excluded.image,
            content = excluded.content,
            last_modified = excluded.last_modified,
            size = excluded.size
    `).bind(
        base,
        meta.title || base.replace(/\.(txt|gtab)$/i, ''),
        meta.artist || '',
        meta.key || '',
        meta.bpm || '',
        meta.capo || '',
        JSON.stringify(Array.isArray(meta.tags) ? meta.tags : []),
        meta.image || '',
        content,
        now,
        existing ? existing.added_date : now,
        new TextEncoder().encode(content).length
    ).run();

    return base;
}

async function deleteSheet(db, filename) {
    const base = normalizeFilename(filename);
    const result = await db.prepare('DELETE FROM sheets WHERE filename = ?').bind(base).run();
    if (!result.meta.changes) {
        throw new ApiError(404, '檔案不存在');
    }
    await db.prepare('DELETE FROM bookmarks WHERE filename = ?').bind(base).run();
}

async function setBookmark(db, filename, bookmarked) {
    const base = normalizeFilename(filename);
    if (bookmarked) {
        await db.prepare('INSERT OR IGNORE INTO bookmarks (filename) VALUES (?)').bind(base).run();
    } else {
        await db.prepare('DELETE FROM bookmarks WHERE filename = ?').bind(base).run();
    }
}

async function readJsonBody(request) {
    try {
        return await request.json();
    } catch (_) {
        throw new ApiError(400, '請求格式錯誤');
    }
}

async function handleApi(request, env, pathname) {
    const db = env.DB;

    if (pathname === '/api/sheets' && request.method === 'GET') {
        return json(await listSheets(db));
    }

    if (pathname === '/api/save-sheet' && request.method === 'POST') {
        const { filename, content } = await readJsonBody(request);
        const saved = await saveSheet(db, filename, content);
        return json({ success: true, message: '檔案儲存成功', filename: saved });
    }

    if (pathname === '/api/delete-sheet' && request.method === 'POST') {
        const { filename } = await readJsonBody(request);
        await deleteSheet(db, filename);
        return json({ success: true, message: '已從樂譜庫刪除' });
    }

    if (pathname === '/api/bookmark' && request.method === 'POST') {
        const { filename, bookmarked } = await readJsonBody(request);
        await setBookmark(db, filename, bookmarked);
        return json({ success: true, message: '書籤更新成功' });
    }

    if (pathname === '/api/import-from-url' && request.method === 'POST') {
        const { urls } = await readJsonBody(request);
        if (!Array.isArray(urls) || urls.length === 0) {
            throw new ApiError(400, 'An array of URLs is required.');
        }
        return json(await importFromUrls(db, urls, saveSheet));
    }

    return json({ success: false, error: 'Not found' }, 404);
}

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);

        if (!pathname.startsWith('/api/')) {
            return env.ASSETS.fetch(request);
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        try {
            return await handleApi(request, env, pathname);
        } catch (error) {
            if (error instanceof ApiError) {
                return json({ success: false, error: error.message }, error.status);
            }
            console.error('API 失敗', pathname, error);
            return json({ success: false, error: error.message || '伺服器內部錯誤' }, 500);
        }
    },
};
