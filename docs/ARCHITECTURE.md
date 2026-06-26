# 專案架構說明

## 一、正式入口

| 入口 | 檔案 | 說明 |
|------|------|------|
| **樂譜庫** | `index.html` | 唯一樂譜庫首頁：列表、搜尋、新增、網址導入、書籤。 |
| **閱讀器** | `reader.html` | 單首樂譜閱讀：播放、變調、指法、載入、編輯入口。 |
| **編輯器** | `editor.html` | 樂譜編輯：文字編輯、儲存、刪除、網址導入。 |

根路徑 `/` 由伺服器導向 `index.html`。

---

## 二、模組職責

### `modules/config/`

集中放**設定與常數**，不包含業務邏輯。

- `section-config.js`：段落類型、顏色、標籤
- `score-config.js`：樂譜渲染（字體、和弦圖尺寸、CSS 類名）
- `library-config.js`：樂譜庫 UI 設定
- `chord-config.js`：和弦相關設定
- `artist-aliases.js`：藝人名稱別名
- `api.js`：API 基底 URL（`API_BASE`），供前端所有 `fetch` 使用

### `modules/utils/`

共用**純函數與小工具**，與頁面、DOM 無強耦合。

- `chord-utils.js`：和弦解析、變調、指法
- `parser-utils.js`：ChordPro / 樂譜解析
- `ui-utils.js`：通用 UI 輔助

### `modules/reader/`

閱讀器專用：單首樂譜的載入、渲染、播放。

- `main.js`：閱讀器入口、DOM 綁定
- `data.js`：樂譜資料與 URL 參數
- `state.js`：閱讀器狀態
- `playback.js`：播放與倒數
- `tuner.js`：調音器
- `ui.js`：閱讀器 UI 行為

### `modules/editor/`

編輯器專用：樂譜的編輯、儲存、載入。

- `io.js`：與後端 API 互動（列表、儲存、刪除、網址導入）
- `ui.js`：編輯器 UI、選單
- `textarea.js`：編輯區行為
- `history.js`： undo/redo
- `custom-chords.js`：自訂和弦

### `modules/library/`

樂譜庫專用：首頁列表、搜尋、書籤、新增、導入。

- `main.js`：樂譜庫入口、事件綁定
- `data.js`：取得樂譜列表（API / GitHub）、書籤
- `ui.js`：列表渲染、網址導入、新樂譜流程
- `state.js`：樂譜庫狀態

### `modules/server/`

Node 後端：靜態檔與 API。

- `modules/server.js`：HTTP 伺服器入口，`PORT` 由環境變數讀取
- `routes.js`：路由、靜態檔、`/api/sheets`、`/api/bookmark`、`/api/save-sheet`、`/api/delete-sheet`、`/api/import-from-url`
- `sheet-service.js`：掃描 `sheets` 目錄、解析樂譜 meta

### 其他

- `modules/importer/url-importer.js`：從網址抓取並解析樂譜，供 library 與 editor 使用
- `modules/services/FileSystemService.js`：檔案系統相關服務（若存在）
- `modules/components/Section.js`：段落元件
- `modules/chord-database.js`：和弦資料
- `modules/index.js`：若有統一匯出可在此

---

## 三、config 與 utils 放置規則

- **config**：鍵值、選項、外觀與行為常數 → `modules/config/`，檔名以 `-config.js` 或語意明確名稱（如 `api.js`、`artist-aliases.js`）。
- **utils**：可被多處共用的純函數、解析器、小工具 → `modules/utils/`，不依賴特定頁面或 DOM。

新功能若為「設定」放 config；若為「共用邏輯」放 utils；若僅單一入口使用則放在該入口所屬模組（reader / editor / library）。

---

## 四、新功能應放位置

| 類型 | 放置位置 |
|------|----------|
| 新 API 基底或環境設定 | `modules/config/api.js` 或新 config 檔 |
| 新共用解析/工具函數 | `modules/utils/` |
| 閱讀器新行為（播放、UI） | `modules/reader/` |
| 編輯器新行為（儲存、編輯、導入） | `modules/editor/` |
| 樂譜庫新行為（列表、書籤、導入） | `modules/library/` |
| 新 API 端點或路由 | `modules/server/routes.js`，必要時搭配 `sheet-service.js` 或新 service |
| 新可重用 UI 元件 | `modules/components/` |

部署與桌面版說明請見 `docs/DEPLOY.md`、`docs/DESKTOP.md`。
