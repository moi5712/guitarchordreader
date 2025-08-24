/* 完整共用函數庫 */

// ==================== 配置常數 ====================

// 段落顏色和標籤配置
const SECTION_CONFIG = {
  colors: {
    verse: '#60a5fa',
    chorus: '#f59e0b', 
    intro: '#10b981',
    bridge: '#8b5cf6',
    outro: '#ef4444',
    solo: '#f97316',
    'pre-chorus': '#06b6d4',
    interlude: '#84cc16',
    tag: '#ec4899',
    coda: '#6b7280'
  },
  
  typeNames: {
    verse: 'Verse',
    chorus: 'Chorus',
    intro: 'Intro',
    bridge: 'Bridge',
    outro: 'Outro',
    solo: 'Solo',
    'pre-chorus': 'Pre-Chorus',
    interlude: 'Interlude',
    tag: 'Tag',
    coda: 'Coda'
  },

  // 不需要編號的段落類型
  singleTypes: ['intro', 'outro', 'bridge', 'solo', 'coda']
};

// 常用和弦列表
const COMMON_CHORDS = [
  "C", "D", "E", "F", "G", "A", "B",
  "Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm",
  "C7", "D7", "E7", "F7", "G7", "A7", "B7",
  "Cmaj7", "Dmaj7", "Emaj7", "Fmaj7", "Gmaj7", "Amaj7", "Bmaj7",
  "Am7", "Bm7", "Cm7", "Dm7", "Em7", "Fm7", "Gm7",
  "Csus4", "Dsus4", "Esus4", "Fsus4", "Gsus4", "Asus4", "Bsus4",
  "N.C."
];

// 樂譜渲染配置
const SCORE_CONFIG = {
  // 字體設置
  fonts: {
    chords: 'var(--mono)',
    lyrics: 'var(--lyrics)',
    sections: 'var(--sans)',
    ui: 'var(--sans)'
  },

  // 和弦指法圖設置
  chordDiagram: {
    width: 65,
    baseHeight: 90,
    fretHeight: 12,
    stringSpacing: 8,
    fretStartY: 28,
    maxFrets: 5
  },

  // 樣式類名
  cssClasses: {
    chordName: 'chord-name',
    chordDiagram: 'chord-diagram',
    chordDiagramTitle: 'chord-diagram-title',
    line: 'line',
    chords: 'chords',
    lyrics: 'lyrics',
    section: 'sec'
  }
};

// 樂譜庫配置
const SHEET_LIBRARY = {
  sheets: [], // 動態載入的樂譜列表
  storageKey: 'guitarSheetLibrary', // localStorage 鍵名
  directoryHandle: null, // 資料夾控制代碼
  directoryStorageKey: 'guitarSheetDirectoryHandle' // 資料夾控制代碼儲存鍵名
};

// 檢查瀏覽器是否支援 File System Access API
function supportsFileSystemAccess() {
  return 'showDirectoryPicker' in window;
}

// 選擇樂譜資料夾 (File System Access API)
async function selectSheetsDirectory() {
  if (!supportsFileSystemAccess()) {
    console.log('瀏覽器不支援 File System Access API');
    return await scanSheetsFolder();
  }

  try {
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'read',
      startIn: 'documents'
    });

    SHEET_LIBRARY.directoryHandle = directoryHandle;

    // 保存資料夾控制代碼 (在某些瀏覽器中可能不工作)
    try {
      await navigator.storage.persist();
      // 無法直接序列化 FileSystemDirectoryHandle，只保存路徑信息
      localStorage.setItem(SHEET_LIBRARY.directoryStorageKey, JSON.stringify({
        name: directoryHandle.name,
        kind: directoryHandle.kind
      }));
    } catch (e) {
      console.log('無法保存資料夾控制代碼');
    }

    return await scanDirectoryForSheets(directoryHandle);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('已取消選擇');
      return SHEET_LIBRARY.sheets;
    }
    console.error('選擇失敗:', error);
  }
}

// 段落類型配置
const SECTION_TYPES = [
  { key: "intro", name: "前奏", class: "intro" },
  { key: "verse", name: "主歌", class: "verse" },
  { key: "pre-chorus", name: "預副歌", class: "pre-chorus" },
  { key: "chorus", name: "副歌", class: "chorus" },
  { key: "interlude", name: "間奏", class: "interlude" },
  { key: "solo", name: "獨奏", class: "solo" },
  { key: "bridge", name: "橋段", class: "bridge" },
  { key: "outro", name: "尾奏", class: "outro" }
];

// 和弦變調映射
const CHORD_MAP = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const CHORD_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ==================== 核心解析函數 ====================

// 格式化段落標籤
function formatSectionLabel(type, count) {
  const typeName = SECTION_CONFIG.typeNames[type] || type[0].toUpperCase() + type.slice(1);
  
  if (SECTION_CONFIG.singleTypes.includes(type) && count === 1) {
    return typeName;
  }
  
  return `${typeName} ${count}`;
}

// 統一的解析函數
function parseInput(text, skipCustomChords = false) {
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
    if (skipCustomChords && /^@[A-Za-z0-9#b/\-+()]+:\s*/.test(ln.trim())) {
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
function parseCustomChords(text) {
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

// ==================== 和弦處理函數 ====================

// 和弦變調
function transposeChord(chord, semitones) {
  if (!chord) return chord;
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord;

  const root = m[1];
  const rest = m[2] || '';

  const rootIndex = CHORD_MAP[root];
  if (rootIndex === undefined) return chord;
  const newRoot = CHORD_NAMES[(rootIndex + semitones + 12) % 12];

  // 若存在轉位（slash chord），同時變調斜線後的低音音名
  const slashPos = rest.indexOf('/');
  if (slashPos !== -1) {
    const pre = rest.slice(0, slashPos); // 後綴（m, dim, aug, sus, maj7...）維持不變
    const bassPart = rest.slice(slashPos + 1);

    const bm = bassPart.match(/^([A-G][#b]?)(.*)$/);
    if (bm) {
      const bassRoot = bm[1];
      const bassRest = bm[2] || '';
      const bassIndex = CHORD_MAP[bassRoot];
      if (bassIndex === undefined) {
        return newRoot + rest; // 低音不是音名則不處理
      }
      const newBass = CHORD_NAMES[(bassIndex + semitones + 12) % 12];
      return newRoot + pre + '/' + newBass + bassRest;
    }
  }

  // 非轉位和弦：僅變調主音，其餘字串保持
  return newRoot + rest;
}

// 檢測大橫按
function detectBarres(fingering, startFret, endFret) {
  const barres = [];
  const validFrets = fingering.filter(f => f > 0);
  if (validFrets.length === 0) return barres;
  
  const minFret = Math.min(...validFrets);
  if (minFret < startFret || minFret > endFret) return barres;
  
  const stringsOnMinFret = [];
  fingering.forEach((f, stringIndex) => {
    if (f === minFret) {
      stringsOnMinFret.push(stringIndex);
    }
  });
  
  if (stringsOnMinFret.length >= 2) {
    stringsOnMinFret.sort((a, b) => a - b);
    let consecutiveGroups = [];
    let currentGroup = [stringsOnMinFret[0]];
    
    for (let i = 1; i < stringsOnMinFret.length; i++) {
      const currentString = stringsOnMinFret[i];
      const prevString = stringsOnMinFret[i-1];
      
      let hasOpenStringBetween = false;
      for (let s = prevString + 1; s < currentString; s++) {
        if (fingering[s] === 0) {
          hasOpenStringBetween = true;
          break;
        }
      }
      
      if (currentString === prevString + 1 || !hasOpenStringBetween) {
        currentGroup.push(currentString);
      } else {
        if (currentGroup.length >= 2) {
          consecutiveGroups.push(currentGroup);
        }
        currentGroup = [currentString];
      }
    }
    
    if (currentGroup.length >= 2) {
      consecutiveGroups.push(currentGroup);
    }
    
    consecutiveGroups.forEach(group => {
      const groupSize = group.length;
      const span = Math.max(...group) - Math.min(...group) + 1;
      const includes1stString = group.includes(0);
      const isRealBarre = groupSize >= 3 || includes1stString || span >= 4;
      
      if (isRealBarre) {
        barres.push({
          fret: minFret,
          fromString: Math.min(...group),
          toString: Math.max(...group)
        });
      }
    });
  }
  
  return barres;
}

// 創建和弦指法圖SVG
function createChordDiagram(chord, options = {}) {
  const { 
    transposeValue = 0, 
    customChordFingerings = {},
    chordFingerings = {} 
  } = options;
  
  const transposedChord = transposeChord(chord, transposeValue);
  const fingering = customChordFingerings[transposedChord] || chordFingerings[transposedChord];

  if (!fingering) {
    return `<span class="chord-name">${transposedChord}</span>`;
  }

  const validFrets = fingering.filter(f => f > 0);
  const minFret = validFrets.length > 0 ? Math.min(...validFrets) : 1;
  const maxFret = validFrets.length > 0 ? Math.max(...validFrets) : 5;
  
  let startFret, endFret, numFrets;
  if (maxFret <= 5) {
    startFret = 1;
    endFret = 5;
    numFrets = 5;
  } else {
    startFret = minFret;
    endFret = startFret + 4;
    numFrets = 5;
    
    if (endFret < maxFret) {
      endFret = maxFret;
      startFret = Math.max(1, endFret - 4);
      numFrets = endFret - startFret + 1;
    }
  }

  const { width, baseHeight, fretHeight, stringSpacing, fretStartY } = SCORE_CONFIG.chordDiagram;
  const height = baseHeight + (numFrets - 5) * fretHeight;

  let svg = `<svg width="${width}" height="${height}" class="chord-diagram" style="display: inline-block; vertical-align: top; margin: 0 2px;">`;
  svg += `<rect width="${width}" height="${height}" fill="white" stroke="#ddd" stroke-width="1" rx="4"/>`;
  svg += `<text x="${width/2-2}" y="14" text-anchor="middle" font-size="18" font-weight="bold" fill="#333" class="chord-diagram-title">${transposedChord}</text>`;

  if (startFret > 1) {
    svg += `<text x="4" y="${fretStartY + fretHeight/2 + 4}" text-anchor="middle" font-size="14" font-weight="bold" fill="#000">${startFret}</text>`;
  }

  for (let i = 0; i < 6; i++) {
    const x = 10 + i * stringSpacing;
    svg += `<line x1="${x}" y1="${fretStartY}" x2="${x}" y2="${fretStartY + numFrets * fretHeight}" stroke="#666" stroke-width="1"/>`;
  }

  for (let i = 0; i <= numFrets; i++) {
    const y = fretStartY + i * fretHeight;
    const isNut = (startFret === 1 && i === 0);
    svg += `<line x1="10" y1="${y}" x2="${10 + 5 * stringSpacing}" y2="${y}" stroke="#666" stroke-width="${isNut ? 2 : 1}"/>`;
  }

  const barres = detectBarres(fingering, startFret, endFret);
  barres.forEach(barre => {
    const y = fretStartY + (barre.fret - startFret + 0.5) * fretHeight;
    const x1 = 10 + barre.fromString * stringSpacing;
    const x2 = 10 + barre.toString * stringSpacing;
    svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#333" stroke-width="6" stroke-linecap="round" opacity="0.8"/>`;
  });

  fingering.forEach((fret, stringIndex) => {
    const x = 10 + stringIndex * stringSpacing;
    if (fret === 0) {
      svg += `<circle cx="${x}" cy="22" r="3" fill="none" stroke="#333" stroke-width="1"/>`;
    } else if (fret === -1) {
      svg += `<text x="${x}" y="27" text-anchor="middle" font-size="16" fill="#666">×</text>`;
    } else if (fret >= startFret && fret <= endFret) {
      const y = fretStartY + (fret - startFret + 0.5) * fretHeight;
      svg += `<circle cx="${x}" cy="${y}" r="3" fill="#333"/>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// ==================== 模態視窗函數 ====================

// 顯示警告
function showAlert(message, title = "通知") {
  const modal = document.getElementById("customModal");
  if (!modal) return Promise.resolve(true);
  
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMessage").textContent = message;
  document.getElementById("modalConfirmBtn").classList.add("hidden");
  document.getElementById("modalCancelBtn").classList.add("hidden");
  document.getElementById("modalAlertOkBtn").classList.remove("hidden");
  modal.classList.add("visible");

  return new Promise((resolve) => {
    document.getElementById("modalAlertOkBtn").onclick = () => {
      modal.classList.remove("visible");
      resolve(true);
    };
  });
}

// 顯示確認對話框
function showConfirm(message, title = "確認") {
  const modal = document.getElementById("customModal");
  if (!modal) return Promise.resolve(false);
  
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMessage").textContent = message;
  document.getElementById("modalAlertOkBtn").classList.add("hidden");
  document.getElementById("modalConfirmBtn").classList.remove("hidden");
  document.getElementById("modalCancelBtn").classList.remove("hidden");
  modal.classList.add("visible");

  return new Promise((resolve) => {
    document.getElementById("modalConfirmBtn").onclick = () => {
      modal.classList.remove("visible");
      resolve(true);
    };
    document.getElementById("modalCancelBtn").onclick = () => {
      modal.classList.remove("visible");
      resolve(false);
    };
  });
}

// ==================== 樂譜庫功能 ====================

// 解析樂譜文件的 meta 信息
function parseSheetMeta(content) {
  const meta = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) break;

    const match = trimmed.match(/^#(\w+):\s*(.*)$/);
    if (match) {
      meta[match[1]] = match[2];
    }
  }

  return meta;
}

// 載入樂譜文件並解析 meta 信息
async function loadSheetMeta(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;

    const content = await response.text();
    const meta = parseSheetMeta(content);

    return {
      title: meta.title || path.split('/').pop().replace(/\.(txt|gtab)$/, ''),
      artist: meta.artist || '',
      content: content
    };
  } catch (error) {
    console.error(`無法載入樂譜 meta: ${path}`, error);
    return null;
  }
}