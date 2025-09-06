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

// This function contains the logic to process one URL.
// It's async and will run in the background for each URL.
async function processSingleUrl(importUrl) {
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
            return; // Stop processing this URL
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
                // Optionally save the failed JSON for debugging
                const debugJsonPath = path.join(__dirname, '..', '..', `debug_failed_json_${sanitize_filename(extracted_song || 'unknown')}.txt`);
                fs.writeFileSync(debugJsonPath, sheet_data_string, 'utf8');
                return; // Stop processing
            }
        } else {
            console.log(`--- [LOG] Could not find "var ufret_chord_datas" for ${importUrl}. ---`);
            // Optionally save the HTML for debugging
            const debugHtmlPath = path.join(__dirname, '..', '..', `debug_no_variable_${sanitize_filename(extracted_song || 'unknown')}.html`);
            fs.writeFileSync(debugHtmlPath, htmlContent, 'utf8');
            return; // Stop processing
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
        const filePath = path.join(__dirname, '..', '..', 'sheets', finalFilename);
        
        const processedContent = output_lines.join('\n');
        fs.writeFileSync(filePath, processedContent, 'utf8');
        console.log(`--- [LOG] File saved successfully: ${finalFilename} ---`);

    } catch (error) {
        console.error(`--- [FATAL ERROR] An error occurred during processing of ${importUrl}:`, error);
        const errorLogPath = path.join(__dirname, '..', '..', `debug_error_${Date.now()}.log`);
        fs.writeFileSync(errorLogPath, `Error processing ${importUrl}:\n\n${error.stack}`, 'utf8');
    }
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

            // Process each URL in the background
            for (const url of urls) {
                processSingleUrl(url);
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
    handleImportFromUrl
};