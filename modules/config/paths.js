/**
 * 靜態站（GitHub Pages 專案頁）會掛在 /repo-name/ 底下，
 * 根路徑 /styles.css 會 404，前端資源改走這裡。
 */
export function getBasePath() {
  if (typeof window === "undefined") return "";
  if (typeof window.__APP_BASE === "string") return window.__APP_BASE;
  const { hostname, pathname } = window.location;
  if (/\.github\.io$/i.test(hostname)) {
    const segs = pathname.split("/").filter(Boolean);
    if (segs[0] && !/\.html?$/i.test(segs[0])) return `/${segs[0]}`;
  }
  return "";
}

export function assetUrl(path) {
  const normalized = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${getBasePath()}${normalized}`;
}
