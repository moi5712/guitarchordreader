const fs = require('fs');
const path = require('path');

const SHEETS_DIR = path.join(__dirname, '..', '..', 'sheets'); // Adjust path to be relative to this file

// 解析樂譜 meta 資訊
function parseSheetMeta(content) {
    const meta = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) continue; // Skip empty lines

        if (!trimmed.startsWith('#') && !trimmed.startsWith('@')) {
            break; // Stop at the first content line
        }

        if (trimmed.startsWith('#')) {
            const match = trimmed.match(/^#(\w+):\s*(.*)$/);
            if (match) {
                if (match[1] === 'tags') {
                    meta.tags = match[2].split(',').map(tag => tag.trim()).filter(tag => tag);
                } else {
                    meta[match[1]] = match[2];
                }
            }
        } else if (trimmed.startsWith('@image:') || trimmed.startsWith('@image=')) {
            const match = trimmed.match(/^@image[:=]\s*(.*)$/);
            if (match) {
                meta.image = match[1].trim();
            }
        }
    }
    
    return meta;
}

// 掃描樂譜文件夾
function scanSheetsFolder() {
    try {
        const files = fs.readdirSync(SHEETS_DIR);
        const sheets = [];
        
        for (const filename of files) {
            if (filename.endsWith('.txt') || filename.endsWith('.gtab')) {
                const filePath = path.join(SHEETS_DIR, filename);
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                const meta = parseSheetMeta(content);
                
                sheets.push({
                    filename: filename,
                    title: meta.title || path.parse(filename).name,
                    artist: meta.artist || '',
                    key: meta.key || '',
                    bpm: meta.bpm || '',
                    capo: meta.capo || '',
                    tags: meta.tags || [], // 添加標籤欄位
                    image: meta.image || '',
                    content: content,
                    lastModified: stats.mtime.getTime(),
                    size: stats.size
                });
            }
        }
        
        // 按檔案名排序
        sheets.sort((a, b) => a.filename.localeCompare(b.filename));
        
        return {
            success: true,
            count: sheets.length,
            sheets: sheets
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            sheets: []
        };
    }
}

module.exports = {
    scanSheetsFolder,
    parseSheetMeta
};
