import { SECTION_CONFIG } from '../config/section-config.js';

// 格式化段落標籤
export function formatSectionLabel(type, count) {
    const typeName = SECTION_CONFIG.typeNames[type] || type[0].toUpperCase() + type.slice(1);
    
    if (SECTION_CONFIG.singleTypes.includes(type) && count === 1) {
      return typeName;
    }
    
    return `${typeName} ${count}`;
  }
  
// 統一的解析函數
export function parseInput(text, skipCustomChords = false) {
    const lines = text.split(/\r?\n/);
    let cur = null;
    const out = [];
    
    const start = (type) => {
      const id = type + "-" + (out.filter((s) => s.type === type).length + 1);
      const sectionCount = out.filter((s) => s.type === type).length + 1;
  
      cur = {
        id,
        type,
        label: formatSectionLabel(type, sectionCount),
        color: SECTION_CONFIG.colors[type] || '#6b7280',
        barsPerLine: 2,
        lines: [],
      };
      out.push(cur);
    };
  
    for (const ln of lines) {
      // 跳過自訂義和弦定義行（如果需要）
      if (skipCustomChords && /^@[A-Za-z0-9#b\/\-+()]+:\s*/.test(ln.trim())) {
        continue;
      }
  
      // 檢查段落標記
      const sec = /^\[(verse|chorus|intro|bridge|outro|solo|pre-chorus|interlude|tag|coda)\]/i.exec(ln);
      if (sec) {
        start(sec[1].toLowerCase());
        continue;
      }
      
      // 處理空行
      if (!ln.trim()) {
        if (cur) {
          cur.lines.push({ raw: "", lyrics: "", chords: [] });
        }
        continue;
      }
      
      // 只有在遇到實際內容時才創建默認段落
      if (!cur) {
        start("verse");
      }
  
      // 解析和弦和歌詞
      const trimmedLine = ln.trimStart();
      let lyrics = "", chords = [], re = /\[(.*?)\]/g, last = 0, m;
      
      while ((m = re.exec(trimmedLine))) {
        lyrics += trimmedLine.slice(last, m.index);
        chords.push({ pos: lyrics.length, chord: m[1] });
        last = m.index + m[0].length;
      }
      lyrics += trimmedLine.slice(last);
      cur.lines.push({ raw: trimmedLine, lyrics, chords });
    }
    
    return out;
  }
  
  
// 解析自訂義和弦指法
export function parseCustomChords(text) {
    const customChords = {};
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
      if (!line.startsWith('@')) continue;
      
      const m = line.match(/^@([^:]+):\s*(.*)$/);
      if (m) {
        const chordName = m[1].trim();
        const fingeringStr = m[2].trim();
        try {
          const fingering = fingeringStr.split(',').map(s => {
            const val = s.trim();
            return val === '-1' ? -1 : parseInt(val);
          });
  
          if (fingering.length === 6 && fingering.every(f => Number.isInteger(f) && f >= -1 && f <= 12)) {
            customChords[chordName] = fingering;
          }
        } catch (e) {
          console.warn(`解析指法失敗: ${line}`);
        }
      }
    }
    
    return customChords;
  }

// 解析樂譜文件的 meta 信息
export function parseSheetMeta(content) {
    const meta = {};
    const lines = content.split(/\r?\n/);
  
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('#')) break;
  
      const match = trimmed.match(/^#(\w+):\s*(.*)$/);
      if (match) {
        if (match[1] === 'tags') {
          // 解析標籤，支援逗號分隔
          meta.tags = match[2].split(',').map(tag => tag.trim()).filter(tag => tag);
        } else {
          meta[match[1]] = match[2];
        }
      }
    }
  
    return meta;
  }
