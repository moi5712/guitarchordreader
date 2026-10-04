import { loadSheetLibrary, filterSheets } from './data.js';
import { setupEventListeners, renderSheets, renderTagButtons, updateStatus, showEmptyState, hideLoadingState, showLoadingState, syncSearchExpanded, applyLibraryView } from './ui.js';
import { applyLibraryPrefs } from './persist.js';

// 初始化
async function init() {
    showLoadingState();
    setupEventListeners();
    const sheets = await loadSheetLibrary();
    applyLibraryPrefs();
    applyLibraryView();
    syncSearchExpanded();
    filterSheets();
    renderSheets();
    renderTagButtons();
    updateStatus();
    if (sheets.length === 0) {
        showEmptyState();
    }
    hideLoadingState();
    prefetchSheetPages();
}

function prefetchSheetPages() {
    const hrefs = [
        "/reader.html",
        "/editor.html",
        "/chords.json",
        "/modules/reader/main.js",
        "/modules/editor/ui.js",
    ];
    const run = () => {
        hrefs.forEach((href) => {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = href;
            document.head.appendChild(link);
        });
    };
    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 1500 });
    } else {
        setTimeout(run, 200);
    }
}

// 頁面載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
