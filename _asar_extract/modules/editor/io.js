import { closeModal, showConfirm, showAlert } from '../utils/ui-utils.js';
import { parseSheetMeta } from '../utils/parser-utils.js';
import { loadCustomChordsFromText } from './custom-chords.js';
import { saveToHistory } from './history.js';
import { API_BASE } from '../config/api.js';

let currentFilename = null;

// 初始化：載入時從 sessionStorage 還原檔案名稱
function initIO() {
    const savedFilename = sessionStorage.getItem('currentFilename');
    if (savedFilename) {
        currentFilename = savedFilename;
    }
}
initIO();

export function getCurrentFilename() {
    return currentFilename;
}

// 設定檔案名稱同步到 sessionStorage
export function setCurrentFilename(filename) {
    currentFilename = filename;
    if (filename) {
        sessionStorage.setItem('currentFilename', filename);
    } else {
        sessionStorage.removeItem('currentFilename');
    }
}

// 新建文件
export async function newDocument() {
    if (await showConfirm("確定要新建文件嗎？未保存的內容將會丟失。")) {
        saveToHistory();
        const emptyContent = "#title: \n#artist: \n\n[verse]\n";
        document.getElementById("editorTextarea").value = emptyContent;
        sessionStorage.setItem("currentSheetContent", emptyContent);
        ["songTitle", "songArtist", "songTags", "songKey", "songBpm", "songCapo"].forEach(
            (id) => {
                document.getElementById(id).value = "";
            }
        );
        // 新建文件時，重設當前檔案名稱
        setCurrentFilename(null);
    }
}

// 匯出檔案
export async function exportDocument() {
    const content = document.getElementById("editorTextarea").value;
    if (!content.trim()) {
        await showAlert("沒有內容可以匯出");
        return;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const title = document.getElementById("songTitle").value || "未命名";
    const artist = document.getElementById("songArtist").value || "";
    a.download = title + (artist ? " by " + artist : "") + ".gtab";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 導入檔案
export function importDocument(text, filename) {
    saveToHistory();
    document.getElementById("editorTextarea").value = text;
    sessionStorage.setItem("currentSheetContent", text); // 更新暫存區
    setCurrentFilename(filename || null);
    sessionStorage.setItem('currentFilename', filename || "");

    // 清空所有欄位
    ["songTitle", "songArtist", "songTags", "songKey", "songBpm", "songCapo", "songImg"].forEach(
        (id) => {
            document.getElementById(id).value = "";
        }
    );

    const meta = parseSheetMeta(text);

    // 填入新的 meta 資訊
    if (meta.title) document.getElementById("songTitle").value = meta.title;
    if (meta.artist) document.getElementById("songArtist").value = meta.artist;
    if (meta.tags) document.getElementById("songTags").value = meta.tags.join(", ");
    if (meta.key) document.getElementById("songKey").value = meta.key;
    if (meta.bpm) document.getElementById("songBpm").value = meta.bpm;
    if (meta.capo) document.getElementById("songCapo").value = meta.capo;
    if (meta.image) document.getElementById("songImg").value = meta.image;

    // 載入自定義和弦
    loadCustomChordsFromText(text);
}

// 儲存檔案
export async function saveToSheetsFolder() {
    if (!window.electronAPI?.saveSheetAs) {
        showAlert("儲存無法使用：未偵測到桌面版環境。請用「吉他譜閱讀器編輯器」exe 開啟（免安裝或安裝版皆可）。");
        return;
    }
    const content = document.getElementById("editorTextarea").value;
    if (!content.trim()) {
        return showAlert("請先輸入樂譜內容");
    }

    const songTitle = document.getElementById("songTitle").value.trim() || "未命名";
    const baseName = (currentFilename || songTitle).replace(/\.gtab$|\.txt$/i, "").trim() || "未命名";
    const useGtabExt = currentFilename ? /\.gtab$/i.test(currentFilename) : true;
    const suggestedFilename = `${baseName}${useGtabExt ? ".gtab" : ".txt"}`;
    
    try {
        const result = await Promise.race([
            window.electronAPI.saveSheetAs(suggestedFilename, content),
            new Promise((_, reject) => setTimeout(() => reject(new Error("儲存逾時（15 秒）")), 15000))
        ]);
        if (result === undefined) {
            showAlert("儲存失敗：未收到回應。請確認使用桌面版 exe 開啟，並重新建置後再試。");
            return;
        }
        if (result?.canceled) {
            return;
        }
        if (result && result.success !== false) {
            if (result.filename) {
                setCurrentFilename(result.filename);
            }
            return;
        } else {
            showAlert(`儲存失敗：${result?.error || '未知錯誤'}`);
        }
    } catch (error) {
        console.error("儲存錯誤:", error);
        showAlert(`儲存失敗：${error.message}`);
    }
}


// 從樂譜庫刪除目前編輯的檔案（會刪除 sheets 資料夾內的實體檔案）
export async function deleteSheetFromLibrary() {
    const filename = getCurrentFilename();
    if (!filename) {
        return { success: false, error: '沒有正在編輯的樂譜檔案' };
    }
    try {
        if (window.electronAPI?.deleteSheet) {
            await window.electronAPI.deleteSheet(filename);
            return { success: true };
        }
        const response = await fetch(API_BASE + "/api/delete-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename }),
        });
        const text = await response.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (_) {
            if (!response.ok) {
                return { success: false, error: text || response.statusText || "請求失敗" };
            }
        }
        if (!response.ok) {
            return { success: false, error: data.error || text || response.statusText };
        }
        return { success: true };
    } catch (error) {
        console.error("刪除樂譜失敗:", error);
        return { success: false, error: error.message };
    }
}

// 網址導入樂譜
export async function importFromUrl() {
    const urlText = document.getElementById("urlTextarea").value.trim();
    if (!urlText) {
        showAlert("請貼上網址");
        return;
    }

    // 以換行分割，過濾空白行
    const urls = urlText.split('\n').map(url => url.trim()).filter(url => url);

    if (urls.length === 0) {
        showAlert("請貼上有效的網址");
        return;
    }

    try {
        if (window.electronAPI?.importFromUrl) {
            const result = await window.electronAPI.importFromUrl(urls);
            if (result && result.success !== false) {
                closeModal(document.getElementById("importUrlModal"));
                showAlert(`已成功轉換 ${result.processed || urls.length} 個網址。請重新整理首頁。`);
            } else {
                showAlert(`導入失敗: ${result?.error || '未知錯誤'}`, "錯誤");
            }
            return;
        }
        const response = await fetch(API_BASE + "/api/import-from-url", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls: urls }),
        });
        const result = await response.json();
        if (result.success) {
            closeModal(document.getElementById("importUrlModal"));
            showAlert(`已成功轉換${result.processed} 個網址。請重新整理首頁。`);
        } else {
            showAlert(`導入失敗: ${result.error}`, "錯誤");
        }
    } catch (e) {
        console.error("導入失敗 :", e);
        showAlert("導入失敗，請查看控制台錯誤訊息。", "錯誤");
    }
}