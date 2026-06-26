const KEY = "sheetUsage";

function contentHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

export function makeUsageKey(filename, text = "") {
  if (filename) return filename;
  return `content:${contentHash(text || "")}`;
}

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("無法寫入樂譜開啟次數：", e);
  }
}

export function recordSheetOpen(filename, text = "") {
  const key = makeUsageKey(filename, text);
  const all = readAll();
  const prev = all[key] || { openCount: 0, lastOpenedAt: 0 };
  all[key] = {
    openCount: (prev.openCount || 0) + 1,
    lastOpenedAt: Date.now(),
  };
  writeAll(all);
}

export function getSheetUsage(filename, text = "") {
  const key = makeUsageKey(filename, text);
  const entry = readAll()[key];
  if (!entry) return { openCount: 0, lastOpenedAt: 0 };
  return {
    openCount: Number(entry.openCount) || 0,
    lastOpenedAt: Number(entry.lastOpenedAt) || 0,
  };
}

export function getOpenCount(filename, text = "") {
  return getSheetUsage(filename, text).openCount;
}
