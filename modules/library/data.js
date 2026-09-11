import { API_BASE } from "../config/api.js";
import { parseSheetMeta } from "../utils/parser-utils.js";
import { getOpenCount, getSheetUsage } from "./usage.js";
import {
  currentSheets,
  filteredSheets,
  normalTagCounts,
  artistTagCounts,
  selectedTags,
  sortBy,
  setCurrentSheets,
  setFilteredSheets,
  setNormalTagCounts,
  setArtistTagCounts,
  showBookmarksOnly,
} from "./state.js";

function toTimestamp(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return isNaN(t) ? 0 : t;
  }
  return 0;
}
function getLatestTs(sheet) {
  const lm = toTimestamp(sheet.lastModified);
  const ad = toTimestamp(sheet.addedDate);
  return Math.max(lm, ad);
}
function getEarliestTs(sheet) {
  const lm = toTimestamp(sheet.lastModified);
  const ad = toTimestamp(sheet.addedDate);
  const vals = [lm, ad].filter((v) => v && Number.isFinite(v));
  return vals.length ? Math.min(...vals) : 0;
}
function compareSheets(a, b) {
  switch (sortBy) {
    case "Z-A":
      return (b.title || "").localeCompare(a.title || "");
    case "latest":
      return getLatestTs(b) - getLatestTs(a);
    case "earliest":
      return getEarliestTs(a) - getEarliestTs(b);
    case "frequent": {
      const countA = getOpenCount(a.filename, a.content);
      const countB = getOpenCount(b.filename, b.content);
      if (countB !== countA) return countB - countA;
      const lastA = getSheetUsage(a.filename, a.content).lastOpenedAt;
      const lastB = getSheetUsage(b.filename, b.content).lastOpenedAt;
      if (lastB !== lastA) return lastB - lastA;
      return (a.title || "").localeCompare(b.title || "");
    }
    default:
      return (a.title || "").localeCompare(b.title || "");
  }
}

// --- 從後端載入樂譜庫 ---
async function autoScanSheetsFolder() {
  try {
    // Electron IPC（不佔 port）
    if (typeof window !== 'undefined' && window.electronAPI?.getSheets) {
      const data = await window.electronAPI.getSheets();
      if (data && data.sheets) {
        console.log(`Electron API :掃描完成，${data.sheets.length} 首樂譜`);
        return data.sheets;
      }
      return [];
    }

    // 方法1: Node.js API（HTTP 伺服器）
    try {
      const response = await fetch(API_BASE + "/api/sheets");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.sheets) {
          console.log(`Node.js API :掃描完成，${data.count} 首樂譜`);
          return data.sheets;
        }
      }
    } catch (apiError) {
      console.log("Node.js API :掃描失敗", apiError);
    }
  } catch (error) {
    console.log("讀取失敗", error);
  }

  return [];
}

// --- 載入樂譜庫 ---
export async function loadSheetLibrary() {
  let sheets = await autoScanSheetsFolder();

  setCurrentSheets(sheets);
  setFilteredSheets([...currentSheets]);

  // 收集所有標籤
  collectTags();
  return sheets;
}

// --- 收集標籤並計數 ---
function collectTags() {
  const newNormalTagCounts = new Map();
  const newArtistTagCounts = new Map();

  currentSheets.forEach((sheet) => {
    // 普通標籤
    if (sheet.tags && Array.isArray(sheet.tags)) {
      sheet.tags.forEach((tag) => {
        if (tag) {
          newNormalTagCounts.set(tag, (newNormalTagCounts.get(tag) || 0) + 1);
        }
      });
    }
    // 作者標籤
    if (sheet.artist) {
      const artists = String(sheet.artist)
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      artists.forEach((a) => {
        newArtistTagCounts.set(a, (newArtistTagCounts.get(a) || 0) + 1);
      });
    }
  });
  setNormalTagCounts(newNormalTagCounts);
  setArtistTagCounts(newArtistTagCounts);
}

// --- 更新書籤 --- 
export async function updateBookmark(filename, bookmarked) {
    try {
        if (typeof window !== 'undefined' && window.electronAPI?.setBookmark) {
            await window.electronAPI.setBookmark(filename, bookmarked);
            const sheet = currentSheets.find(s => s.filename === filename);
            if (sheet) sheet.bookmarked = bookmarked;
            return true;
        }
        const response = await fetch(API_BASE + '/api/bookmark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename, bookmarked }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                const sheet = currentSheets.find(s => s.filename === filename);
                if (sheet) sheet.bookmarked = bookmarked;
                return true;
            }
        }
    } catch (error) {
        console.error('更新書籤失敗:', error);
    }
    return false;
}

// --- 篩選樂譜 ---
export function filterSheets() {
  const searchInput = document.getElementById("searchInput");
  const searchQuery = searchInput.value.toLowerCase().trim();

  const newFilteredSheets = currentSheets.filter((sheet) => {
    // 書籤篩選
    if (showBookmarksOnly && !sheet.bookmarked) {
        return false;
    }

    // 搜尋篩選
    const matchesSearch =
      !searchQuery ||
      sheet.title.toLowerCase().includes(searchQuery) ||
      sheet.artist.toLowerCase().includes(searchQuery) ||
      sheet.filename.toLowerCase().includes(searchQuery) ||
      (sheet.tags &&
        sheet.tags.some((tag) => tag.toLowerCase().includes(searchQuery)));

    // 標籤篩選 (包含作者)
    const artists = sheet.artist
      ? String(sheet.artist)
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];
    const allSheetTags = [...(sheet.tags || []), ...artists].filter(Boolean); // 作者可能有多位，逗號分隔，需拆成多個標籤
    const matchesTags =
      selectedTags.size === 0 ||
      allSheetTags.some((tag) => selectedTags.has(tag));

    return matchesSearch && matchesTags;
  });
  newFilteredSheets.sort(compareSheets);
  setFilteredSheets(newFilteredSheets);
}
