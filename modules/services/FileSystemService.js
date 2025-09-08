import { SHEET_LIBRARY } from '../config/library-config.js';
import { parseSheetMeta } from '../utils/parser-utils.js';

// 檢查瀏覽器是否支援 File System Access API
export function supportsFileSystemAccess() {
    return 'showDirectoryPicker' in window;
}

// 選擇樂譜資料夾 (File System Access API)
export async function selectSheetsDirectory() {
    if (!supportsFileSystemAccess()) {
        console.log('瀏覽器不支援 File System Access API');
        // The function `scanSheetsFolder` is not defined in `function.js`.
        // I will comment it out for now.
        // return await scanSheetsFolder();
        return;
    }

    try {
        const directoryHandle = await window.showDirectoryPicker({
            mode: 'read',
            startIn: 'documents'
        });

        SHEET_LIBRARY.directoryHandle = directoryHandle;

        // 保存資料夾控制代碼 (在某些瀏覽器中可能不工作)
        try {
            await navigator.storage.persist();
            // 無法直接序列化 FileSystemDirectoryHandle，只保存路徑信息
            localStorage.setItem(SHEET_LIBRARY.directoryStorageKey, JSON.stringify({
                name: directoryHandle.name,
                kind: directoryHandle.kind
            }));
        } catch (e) {
            console.log('資料夾控制代碼保存失敗');
        }

        // The function `scanDirectoryForSheets` is not defined in `function.js`.
        // I will comment it out for now.
        // return await scanDirectoryForSheets(directoryHandle);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('已取消選擇');
            return SHEET_LIBRARY.sheets;
        }
        console.error('選擇失敗:', error);
    }
}

// 載入樂譜文件並解析 meta 信息
export async function loadSheetMeta(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) return null;

        const content = await response.text();
        const meta = parseSheetMeta(content);

        return {
            title: meta.title || path.split('/').pop().replace(/\.(txt|gtab)$/, ''),
            artist: meta.artist || '',
            content: content
        };
    } catch (error) {
        console.error(`無法載入樂譜 meta: ${path}`, error);
        return null;
    }
}
