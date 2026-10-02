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
}

// 頁面載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
