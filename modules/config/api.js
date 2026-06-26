/**
 * API 基底 URL。前端所有 fetch('/api/...') 應改為 fetch(API_BASE + '/api/...')。
 * - 同源或靜態站：留空 ''。
 * - 部署時可於載入前設定 sessionStorage.setItem('apiBase', 'https://your-api.com')。
 * - 未來建置可改為讀取 import.meta.env.VITE_API_URL 等。
 */
export const API_BASE =
  (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('apiBase')) || '';
