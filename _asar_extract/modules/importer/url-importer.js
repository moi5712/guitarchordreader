const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Helper function to sanitize filenames
function sanitize_filename(filename) {
    if (!filename) return "untitled";
    const invalid_chars = /[<>:"/\\|?*\x00-\x1f]/g;
    let sanitized = filename.replace(invalid_chars, '');
    sanitized = sanitized.trim();
    return sanitized || "untitled";
}

// Default sheets dir when not provided (for HTTP server)
const DEFAULT_SHEETS_DIR = path.join(__dirname, '..', '..', 'sheets');

// This function contains the logic to process one URL.
// It's async and will run in the background for each URL.
// sheetsDir: optional; if provided, save to this directory (for Electron IPC).
async function processSingleUrl(importUrl, sheetsDir) {
    const targetDir = sheetsDir || DEFAULT_SHEETS_DIR;
    console.log(`--- [LOG] Processing URL: ${importUrl} ---`);
    try {
        // --- Step 1: Fetch content from URL ---
        let htmlContent = '';
        try {
            const response = await fetch(importUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            htmlContent = await response.text();
        } catch (fetchError) {
            console.error(`--- [ERROR] Failed to fetch content from ${importUrl}: ${fetchError.message} ---`);
            return { success: false, url: importUrl, error: fetchError.message };
        }

        // --- Step 2: Convert/Process content ---
        let extracted_artist = "";
        let extracted_song = "";
        let bpm_value = "";
        let capo_value = "";
        const output_lines = [];
        let body_lines = [];

        // --- Metadata Extraction ---
        const opts_match = htmlContent.match(/var opts = {([\s\S]*?)};/);
        if (opts_match) {
            const opts_content = opts_match[1];
            const artist_match = opts_content.match(/artist:\s*"(.*?)"/);
            const song_match = opts_content.match(/song:\s*"(.*?)"/);
            if (artist_match) extracted_artist = artist_match[1].trim();
            if (song_match) extracted_song = song_match[1].trim();
        }

        const bpm_match = htmlContent.match(/const\s+defaultBpm\s*=\s*"(.*?)";/);
        if (bpm_match) {
            bpm_value = bpm_match[1].trim();
        }
        
        const capo_select_match = htmlContent.match(/<select name="keyselect"[^>]*>[\s\S]*?<option value="([^"]*)" selected>/);
        if (capo_select_match && capo_select_match[1]) {
            const raw_capo = parseInt(capo_select_match[1], 10);
            if (!isNaN(raw_capo) && raw_capo < 0) {
                capo_value = (-raw_capo).toString();
            }
        }

        // --- Body Processing ---
        const data_match = htmlContent.match(/var ufret_chord_datas = ([\[\s\S]*?\]);/);
        if (data_match && data_match[1]) {
            let sheet_data_string = data_match[1];
            try {
                body_lines = JSON.parse(sheet_data_string);
            } catch (e) {
                console.error(`--- [ERROR] Failed to parse JSON for ${importUrl}.`, e);
                const debugJsonPath = path.join(targetDir, '..', `debug_failed_json_${sanitize_filename(extracted_song || 'unknown')}.txt`);
                fs.writeFileSync(debugJsonPath, sheet_data_string, 'utf8');
                return { success: false, url: importUrl, error: 'parse JSON failed' };
            }
        } else {
            console.log(`--- [LOG] Could not find "var ufret_chord_datas" for ${importUrl}. ---`);
            const debugHtmlPath = path.join(targetDir, '..', `debug_no_variable_${sanitize_filename(extracted_song || 'unknown')}.html`);
            fs.writeFileSync(debugHtmlPath, htmlContent, 'utf8');
            return { success: false, url: importUrl, error: 'no ufret_chord_datas' };
        }

        // --- Final Assembly ---
        output_lines.push(`#title: ${extracted_song}`);
        output_lines.push(`#artist: ${extracted_artist}`);
        output_lines.push(`#tags: `);
        output_lines.push(`#key: `);
        output_lines.push(`#bpm: ${bpm_value}`);
        output_lines.push(`#capo: ${capo_value}`);
        output_lines.push("");
        output_lines.push(...body_lines);

        // --- Step 3: Determine filename and save ---
        const finalFilename = (extracted_song ? sanitize_filename(extracted_song) : `downloaded_sheet_${Date.now()}`) + '.txt';
        const filePath = path.join(targetDir, finalFilename);
        
        const processedContent = output_lines.join('\n');
        fs.writeFileSync(filePath, processedContent, 'utf8');
        console.log(`--- [LOG] File saved successfully: ${finalFilename} ---`);
        return { success: true, url: importUrl, filename: finalFilename };
    } catch (error) {
        console.error(`--- [FATAL ERROR] An error occurred during processing of ${importUrl}:`, error);
        const errorLogPath = path.join(targetDir, '..', `debug_error_${Date.now()}.log`);
        fs.writeFileSync(errorLogPath, `Error processing ${importUrl}:\n\n${error.stack}`, 'utf8');
        return { success: false, url: importUrl, error: error.message };
    }
}


/**
 * 供 Electron IPC 使用：依 urls 列表從 ufret 抓取並寫入 sheetsDir，回傳結果。
 * @param {string} sheetsDir - 樂譜目錄
 * @param {string[]} urls - 要導入的網址列表
 * @returns {Promise<{ success: boolean, processed: number, results: Array<{ success, url, filename?, error? }> }>}
 */
async function importFromUrlUrls(sheetsDir, urls) {
    const results = [];
    for (const url of urls) {
        const r = await processSingleUrl(url, sheetsDir);
        results.push(r || { success: false, url, error: 'unknown' });
    }
    return {
        success: results.some(r => r.success),
        processed: urls.length,
        results
    };
}

// The main function to handle the import logic
async function handleImportFromUrl(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { urls } = JSON.parse(body);

            if (!urls || !Array.isArray(urls) || urls.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'An array of URLs is required.' }));
                return;
            }

            // Immediately respond to the client
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                processed: urls.length
            }));

            // Process each URL in the background (no await - fire and forget for HTTP)
            for (const url of urls) {
                processSingleUrl(url, null);
            }

        } catch (error) {
            // This catch is for errors in parsing the initial request, not for processing individual URLs
            console.error('--- [FATAL ERROR] Could not parse incoming request body:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: `伺服器內部錯誤: ${error.message}`
            }));
        }
    });
}

module.exports = {
    handleImportFromUrl,
    importFromUrlUrls,
    processSingleUrl
};