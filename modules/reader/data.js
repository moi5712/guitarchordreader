import { setSong, setCustomChordFingerings, song } from './state.js';
import { parseInput } from '../utils/parser-utils.js';

// 獲取當前樂譜內容
export function getCurrentSheetContent() {
  return sessionStorage.getItem("currentSheetContent") || "";
}

// 載入樂譜
export function importScore(text, filename = null) {
  // --- 資料清理與統一 ---
  // 1. 將當前內容設定為唯一的真相來源
  sessionStorage.setItem("currentSheetContent", text);
  // 其餘舊版暫存鍵已全面停用，不再進行清除

  const newCustomChordFingerings = {};
  const meta = {};
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (!line.startsWith("#") && !line.startsWith("@")) {
      break;
    }

    if (line.startsWith("#")) {
      const m = line.match(/^#(\w+):\s*(.*)$/);
      if (m) {
        meta[m[1]] = m[2];
      }
    } else if (line.startsWith("@")) {
      const m = line.match(/^@([^:]+):\s*(.*)$/);
      if (m) {
        const chordName = m[1].trim();
        const fingeringStr = m[2].trim();
        try {
          const fingering = fingeringStr.split(",").map((s) => {
            const val = s.trim();
            return val === "-1" ? -1 : parseInt(val);
          });

          if (
            fingering.length === 6 &&
            fingering.every((f) => Number.isInteger(f) && f >= -1 && f <= 12)
          ) {
            newCustomChordFingerings[chordName] = fingering;
          } else {
            console.warn(`無效的指法格式: ${lines[i]}`);
          }
        } catch (e) {
          console.warn(`解析指法失敗: ${lines[i]}`);
        }
      }
    }
    i++;
  }
  setCustomChordFingerings(newCustomChordFingerings);

  while (i < lines.length && !lines[i].trim()) {
    i++;
  }
  const scoreText = lines.slice(i).join("\n");

  const newSong = {
      ...song,
      originalContent: text,
      sections: parseInput(scoreText),
      meta: {
          ...song.meta,
          title: meta.title || song.meta.title,
          artist: meta.artist || song.meta.artist,
          key: meta.key || song.meta.key,
          bpm: meta.bpm ? Number(meta.bpm) : song.meta.bpm,
          time: meta.time || song.meta.time,
          capo: meta.capo ? Number(meta.capo) : song.meta.capo,
      },
      filename: filename || song.filename || null,
  };
  setSong(newSong);
}

// 儲存設定
export function saveSettings() {
  const settings = {
    fontSize: document.getElementById("fontPx").value,
    lineGap: document.getElementById("lineGap").value,
    transpose: document.getElementById("transpose").value,
    showFingering: document.getElementById("showFingering").checked,
    countdownEnabled: document.getElementById("countdownEnabled").checked,
    speed: document.getElementById("speed").value,
  };
  localStorage.setItem("readerSettings", JSON.stringify(settings));
}
