import { setDefaultChordFingerings } from "./chord-fingerings-store.js";

function normalizeChordFingerings(raw) {
  const out = Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [name, v] of Object.entries(raw)) {
    if (
      Array.isArray(v) &&
      v.length === 6 &&
      v.every((x) => Number.isInteger(x) && x >= -1 && x <= 12)
    ) {
      out[name] = v;
    }
  }
  return out;
}

let loadPromise = null;

/**
 * 載入和弦指法庫：Electron 從 userData/chords.json（主程序複製種子檔）；
 * 瀏覽器／本機伺服器從 /chords.json 取得。
 */
export function loadChordFingerings() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.getChordFingerings) {
        const data = await window.electronAPI.getChordFingerings();
        setDefaultChordFingerings(normalizeChordFingerings(data));
        return;
      }
      const res = await fetch("/chords.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDefaultChordFingerings(normalizeChordFingerings(data));
    } catch (e) {
      console.warn("載入 chords.json 失敗，指法圖將僅顯示和弦名稱：", e);
      setDefaultChordFingerings(Object.create(null));
    }
  })();
  return loadPromise;
}
