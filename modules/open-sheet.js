import { API_BASE } from "./config/api.js";

async function fetchSheet(filename) {
  if (!filename) throw new Error("缺少檔名");
  if (typeof window !== "undefined" && window.electronAPI?.getSheet) {
    const data = await window.electronAPI.getSheet(filename);
    if (data?.sheet) return data.sheet;
    throw new Error(data?.error || "載入樂譜失敗");
  }
  const response = await fetch(
    API_BASE + "/api/sheet?filename=" + encodeURIComponent(filename)
  );
  const data = await response.json();
  if (data.success && data.sheet) return data.sheet;
  throw new Error(data.error || "載入樂譜失敗");
}

export function getRequestedFilename() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("f");
    if (fromQuery) return fromQuery;
  } catch (_) {}
  return sessionStorage.getItem("currentFilename") || "";
}

export function readCachedSheet(filename) {
  const cachedName = sessionStorage.getItem("currentFilename") || "";
  const cachedContent = sessionStorage.getItem("currentSheetContent");
  if (cachedContent == null || cachedContent === "") return null;
  if (filename && cachedName && cachedName !== filename) return null;
  return { filename: filename || cachedName, content: cachedContent };
}

export async function resolveOpenSheet() {
  const filename = getRequestedFilename();
  const cached = readCachedSheet(filename);
  if (cached) return cached;
  if (!filename) {
    return {
      filename: "",
      content: sessionStorage.getItem("currentSheetContent") || "",
    };
  }
  const sheet = await fetchSheet(filename);
  const content = sheet.content || "";
  const name = sheet.filename || filename;
  sessionStorage.setItem("currentSheetContent", content);
  sessionStorage.setItem("currentFilename", name);
  return { filename: name, content };
}

export function clearUrlSheetParam() {
  const cleanUrl =
    window.location.protocol + "//" + window.location.host + window.location.pathname;
  if (window.location.href !== cleanUrl) {
    window.history.replaceState({}, document.title, cleanUrl);
  }
}
