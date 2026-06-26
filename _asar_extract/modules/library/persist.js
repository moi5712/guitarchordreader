import {
  selectedTags,
  setSortBy,
  setShowBookmarksOnly,
  replaceSelectedTags,
  showBookmarksOnly,
} from "./state.js";

const KEY = "libraryPrefs";

const SORT_VALUES = new Set(["A-Z", "Z-A", "latest", "earliest", "frequent"]);

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLibraryPrefs() {
  const searchInput = document.getElementById("searchInput");
  const sortBySelect = document.getElementById("sortBy");
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        search: searchInput ? searchInput.value : "",
        sortBy: sortBySelect ? sortBySelect.value : "A-Z",
        selectedTags: Array.from(selectedTags),
        showBookmarksOnly,
      })
    );
  } catch (e) {
    console.warn("無法寫入樂譜庫篩選設定：", e);
  }
}

/** 從 localStorage 還原搜尋、排序、標籤與書籤篩選（須在 loadSheetLibrary 之後呼叫） */
export function applyLibraryPrefs() {
  const p = readRaw();
  if (!p || typeof p !== "object") return;

  const searchInput = document.getElementById("searchInput");
  const sortBySelect = document.getElementById("sortBy");
  const showBookmarksBtn = document.getElementById("showBookmarksBtn");

  if (typeof p.search === "string" && searchInput) {
    searchInput.value = p.search;
  }
  if (typeof p.sortBy === "string" && sortBySelect && SORT_VALUES.has(p.sortBy)) {
    sortBySelect.value = p.sortBy;
    setSortBy(p.sortBy);
  }
  if (Array.isArray(p.selectedTags)) {
    replaceSelectedTags(p.selectedTags);
  }
  if (typeof p.showBookmarksOnly === "boolean") {
    setShowBookmarksOnly(p.showBookmarksOnly);
    if (showBookmarksBtn) {
      showBookmarksBtn.classList.toggle("active", p.showBookmarksOnly);
    }
  }
}
