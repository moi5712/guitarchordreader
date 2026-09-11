/**
 * 從 U-FRET 頁面抓取樂譜並寫入 D1。
 * 由 modules/importer/url-importer.js 移植，移除 Node 檔案系統相關的除錯輸出。
 */

function sanitizeFilename(filename) {
    const sanitized = String(filename || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
    return sanitized || 'untitled';
}

async function importSingleUrl(db, importUrl, saveSheet) {
    let html;
    try {
        const response = await fetch(importUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        html = await response.text();
    } catch (error) {
        return { success: false, url: importUrl, error: error.message };
    }

    let artist = '';
    let song = '';
    const optsMatch = html.match(/var opts = {([\s\S]*?)};/);
    if (optsMatch) {
        const artistMatch = optsMatch[1].match(/artist:\s*"(.*?)"/);
        const songMatch = optsMatch[1].match(/song:\s*"(.*?)"/);
        if (artistMatch) artist = artistMatch[1].trim();
        if (songMatch) song = songMatch[1].trim();
    }

    let bpm = '';
    const bpmMatch = html.match(/const\s+defaultBpm\s*=\s*"(.*?)";/);
    if (bpmMatch) bpm = bpmMatch[1].trim();

    let capo = '';
    const capoMatch = html.match(/<select name="keyselect"[^>]*>[\s\S]*?<option value="([^"]*)" selected>/);
    if (capoMatch && capoMatch[1]) {
        const raw = parseInt(capoMatch[1], 10);
        if (!Number.isNaN(raw) && raw < 0) capo = String(-raw);
    }

    const dataMatch = html.match(/var ufret_chord_datas = ([\[\s\S]*?\]);/);
    if (!dataMatch || !dataMatch[1]) {
        return { success: false, url: importUrl, error: 'no ufret_chord_datas' };
    }

    let bodyLines;
    try {
        bodyLines = JSON.parse(dataMatch[1]);
    } catch (_) {
        return { success: false, url: importUrl, error: 'parse JSON failed' };
    }

    const content = [
        `#title: ${song}`,
        `#artist: ${artist}`,
        '#tags: ',
        '#key: ',
        `#bpm: ${bpm}`,
        `#capo: ${capo}`,
        '',
        ...bodyLines,
    ].join('\n');

    const filename = `${song ? sanitizeFilename(song) : `downloaded_sheet_${Date.now()}`}.txt`;
    try {
        await saveSheet(db, filename, content);
    } catch (error) {
        return { success: false, url: importUrl, error: error.message };
    }
    return { success: true, url: importUrl, filename };
}

export async function importFromUrls(db, urls, saveSheet) {
    const results = [];
    for (const url of urls) {
        results.push(await importSingleUrl(db, url, saveSheet));
    }
    return {
        success: results.some((r) => r.success),
        processed: results.filter((r) => r.success).length,
        results,
    };
}
