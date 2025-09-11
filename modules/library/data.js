import { parseSheetMeta } from "../utils/parser-utils.js";
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

// --- GitHub API 掃描樂譜檔案 ---
async function scanGitHubSheets() {
  try {
    // 檢查是否為 GitHub Pages
    const isGitHubPages = window.location.hostname.includes("github.io");

    if (isGitHubPages) {
      // 從 URL 推斷 GitHub repo 信息
      const hostname = window.location.hostname;
      const pathParts = window.location.pathname.split("/").filter((p) => p);

      let username, repoName;

      if (hostname.endsWith(".github.io")) {
        username = hostname.split(".")[0];
        repoName = pathParts[0] || username + ".github.io";
      }

      if (username && repoName) {
        const apiUrl = `https://api.github.com/repos/${username}/${repoName}/contents/sheets`;
        console.log(`測試 GitHub API :${apiUrl}`);

        const response = await fetch(apiUrl);
        if (response.ok) {
          const files = await response.json();
          const sheetFiles = files
            .filter(
              (file) =>
                file.type === "file" &&
                (file.name.endsWith(".txt") || file.name.endsWith(".gtab"))
            )
            .map((file) => file.name);

          console.log(`GitHub API :找到 ${sheetFiles.length} 個檔案`);
          return sheetFiles;
        } else {
          console.log(`GitHub API 錯誤 :${response.status}`);
        }
      }
    }

    return [];
  } catch (error) {
    console.log("GitHub API :掃描失敗", error);
    return [];
  }
}

// --- 掃描 sheets 資料夾 ---
async function autoScanSheetsFolder() {
  try {
    // 方法1: Node.js API
    try {
      const response = await fetch("./api/sheets");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.sheets) {
          console.log(`Node.js API :掃描完成，${data.count} 首樂譜`);
          return data.sheets;
        }
      }
    } catch (apiError) {
      console.log("Node.js API :掃描失敗，嘗試其他方法", apiError);
    }

    // 方法2: GitHub API 掃描
    const githubFiles = await scanGitHubSheets();
    if (githubFiles.length > 0) {
      const sheets = [];
      for (const filename of githubFiles) {
        try {
          const response = await fetch(
            `./sheets/${encodeURIComponent(filename)}`
          );
          if (response.ok) {
            const content = await response.text();
            const meta = parseSheetMeta(content);

            sheets.push({
              filename: filename,
              title: meta.title || filename.replace(/\.(txt|gtab)$/, ""),
              artist: meta.artist || "",
              tags: meta.tags || [],
              image: meta.image,
              content: content,
              lastModified: Date.now(),
              addedDate: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.log(`無法讀取檔案 ${filename}:`, error.message);
        }
      }

      if (sheets.length > 0) {
        console.log(`GitHub :掃描完成，${sheets.length} 首樂譜`);
        return sheets;
      }
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
        const response = await fetch('./api/bookmark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename, bookmarked }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // 更新本地數據
                const sheet = currentSheets.find(s => s.filename === filename);
                if (sheet) {
                    sheet.bookmarked = bookmarked;
                }
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
  // 指定排序方式
  const compareByTitleAsc = (a, b) =>
    (a.title || "").localeCompare(b.title || "");
  const compareByTitleDesc = (a, b) =>
    (b.title || "").localeCompare(a.title || "");
  const toTimestamp = (value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const t = Date.parse(value);
      return isNaN(t) ? 0 : t;
    }
    return 0;
  };
  const getLatestTs = (sheet) => {
    const lm = toTimestamp(sheet.lastModified);
    const ad = toTimestamp(sheet.addedDate);
    return Math.max(lm, ad);
  };
  const getEarliestTs = (sheet) => {
    const lm = toTimestamp(sheet.lastModified);
    const ad = toTimestamp(sheet.addedDate);
    const vals = [lm, ad].filter((v) => v && Number.isFinite(v));
    return vals.length ? Math.min(...vals) : 0;
  };

  switch (sortBy) {
    case "A-Z":
      newFilteredSheets.sort(compareByTitleAsc);
      break;
    case "Z-A":
      newFilteredSheets.sort(compareByTitleDesc);
      break;
    case "latest":
      newFilteredSheets.sort((a, b) => getLatestTs(b) - getLatestTs(a));
      break;
    case "earliest":
      newFilteredSheets.sort((a, b) => getEarliestTs(a) - getEarliestTs(b));
      break;
    default:
      newFilteredSheets.sort(compareByTitleAsc);
  }
  setFilteredSheets(newFilteredSheets);
}
