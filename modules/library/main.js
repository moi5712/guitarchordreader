import { loadSheetLibrary } from './data.js';
import { setupEventListeners, renderSheets, renderTagButtons, updateStatus, showEmptyState, hideLoadingState, showLoadingState } from './ui.js';

// 初始化
async function init() {
    showLoadingState();
    setupEventListeners();
    const sheets = await loadSheetLibrary();
    renderSheets();
    renderTagButtons();
    updateStatus();
    if (sheets.length === 0) {
        showEmptyState();
    }
    hideLoadingState();
}

// 頁面載入完成後初始化
window.addEventListener('load', init);
