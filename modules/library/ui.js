import { filteredSheets, currentSheets, selectedTags, normalTagCounts, artistTagCounts, addSelectedTag, deleteSelectedTag, clearSelectedTags, setSortBy, setShowBookmarksOnly, setLibraryView, libraryView, showBookmarksOnly, toggleShowBookmarksOnly } from './state.js';
import { filterSheets, updateBookmark, loadSheetLibrary, fetchSheet } from './data.js';
import { saveLibraryPrefs } from './persist.js';
import { API_BASE } from '../config/api.js';
import { closeModal, openModal, initCustomSelect } from '../utils/ui-utils.js';

// DOM 元素
const sheetsContainer = document.getElementById('sheetsContainer');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const statusBar = document.getElementById('statusBar');
const sheetCount = document.getElementById('sheetCount');
const statusFilters = document.getElementById('statusFilters');
const searchInput = document.getElementById('searchInput');
const normalTagButtons = document.getElementById('normalTagButtons');
const artistTagButtons = document.getElementById('artistTagButtons');
const clearTagsBtn = document.getElementById('clearTagsBtn');
const sortBySelect = document.getElementById('sortBy');
const showBookmarksBtn = document.getElementById('showBookmarksBtn');
const libraryViewBtn = document.getElementById('libraryViewBtn');
const newBtn = document.getElementById('newBtn');
const newMenu = document.getElementById('newMenu');
const librarySearch = document.getElementById('librarySearch');
const emptyMessage = document.getElementById('emptyMessage');
const libraryHeader = document.querySelector('.library-header');
const libraryImportFile = document.getElementById('libraryImportFile');
const libraryFilterDrawer = document.getElementById('libraryFilterDrawer');
const libraryFilterBtn = document.getElementById('libraryFilterBtn');
const libraryFilterBackdrop = document.getElementById('libraryFilterBackdrop');
const libraryFilterClose = document.getElementById('libraryFilterClose');
const libraryToolbarControls = document.querySelector('.library-toolbar-controls');
const libraryHeaderTop = document.querySelector('.library-header-top');
const importUrlModal = document.getElementById('importUrlModal');
const urlTextarea = document.getElementById('urlTextarea');
const importUrlConfirmBtn = document.getElementById('importUrlConfirmBtn');
const importUrlCancelBtn = document.getElementById('importUrlCancelBtn');

function syncLibraryHeaderOffset() {
    if (!libraryHeader) return;
    const height = Math.ceil(libraryHeader.getBoundingClientRect().height);
    if (!height) return;
    document.documentElement.style.setProperty('--library-header-offset', `${height}px`);
    // 手機版 status bar 是 fixed，直接設定 top 避免 CSS 變數初始值錯誤造成被 header 蓋住
    if (statusBar && window.innerWidth <= MOBILE_BREAKPOINT) {
        statusBar.style.top = `${height}px`;
    } else if (statusBar) {
        statusBar.style.top = '';
    }
}

const MOBILE_BREAKPOINT = 640;

function syncToolbarPosition() {
    if (!libraryToolbarControls || !libraryHeaderTop) return;
    if (libraryToolbarControls.parentElement !== libraryHeaderTop) {
        libraryHeaderTop.appendChild(libraryToolbarControls);
    }
}

export function syncSearchExpanded() {
    if (!librarySearch || !searchInput) return;
    librarySearch.classList.toggle('is-open', !!searchInput.value.trim());
}

function getActiveLibraryView() {
    if (libraryView === 'list' || libraryView === 'cards') return libraryView;
    return window.innerWidth <= MOBILE_BREAKPOINT ? 'list' : 'cards';
}

export function applyLibraryView() {
    const view = getActiveLibraryView();
    document.documentElement.classList.toggle('library-view-list', view === 'list');
    document.documentElement.classList.toggle('library-view-cards', view === 'cards');
    if (!libraryViewBtn) return;
    const isList = view === 'list';
    libraryViewBtn.setAttribute('aria-pressed', isList ? 'true' : 'false');
    libraryViewBtn.title = isList ? '卡片視圖' : '清單視圖';
    libraryViewBtn.setAttribute('aria-label', libraryViewBtn.title);
}

function toggleLibraryView() {
    const next = getActiveLibraryView() === 'list' ? 'cards' : 'list';
    setLibraryView(next);
    applyLibraryView();
    saveLibraryPrefs();
}

function decorateSortTrigger() {
    const trigger = document.querySelector('.library-sort-group .custom-select-trigger');
    if (!trigger || trigger.querySelector('.library-sort-icon')) return;
    trigger.setAttribute('title', '排序');
    trigger.setAttribute('aria-label', '排序');
    trigger.insertAdjacentHTML(
        'afterbegin',
        `<svg class="library-sort-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5h18M6 12h12M9 16.5h6" /></svg>`
    );
}

function updateEmptyMessage(pathText) {
    if (!emptyMessage) return;
    const normalized = typeof pathText === 'string' ? pathText.trim() : '';
    if (!normalized) {
        emptyMessage.textContent = '樂譜庫是空的。可新增樂譜，或從資料夾匯入既有檔案。';
        return;
    }
    emptyMessage.textContent = `資料庫：${normalized}`;
}

async function syncSheetsPathHint() {
    if (!window.electronAPI?.getSheetsPath) {
        updateEmptyMessage('');
        return;
    }
    try {
        const pathText = await window.electronAPI.getSheetsPath();
        updateEmptyMessage(pathText);
    } catch (error) {
        console.error('讀取樂譜資料夾路徑失敗:', error);
        updateEmptyMessage('');
    }
}

// 顯示載入狀態
export function showLoadingState() {
    sheetsContainer.classList.add('hidden');
    emptyState.classList.add('hidden');
    loadingState.classList.remove('hidden');
}

// 隱藏載入狀態
export function hideLoadingState() {
    loadingState.classList.add('hidden');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function bindSheetsContainer() {
    if (!sheetsContainer || sheetsContainer.dataset.bound === '1') return;
    sheetsContainer.dataset.bound = '1';
    sheetsContainer.addEventListener('click', async (event) => {
        const card = event.target.closest('.sheet-card');
        if (!card) return;
        const filename = card.dataset.filename;
        if (!filename) return;

        const bookmarkBtn = event.target.closest('.bookmark-icon');
        if (bookmarkBtn) {
            event.preventDefault();
            const next = !bookmarkBtn.classList.contains('bookmarked');
            const success = await updateBookmark(filename, next);
            if (success) bookmarkBtn.classList.toggle('bookmarked', next);
            return;
        }

        if (event.target.closest('.edit-icon')) {
            event.preventDefault();
            navigateToSheet(filename, 'editor');
            return;
        }

        navigateToSheet(filename, 'reader');
    });
}

// 渲染樂譜卡片
export function renderSheets() {
    sheetsContainer.innerHTML = '';

    if (filteredSheets.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();

    const fragment = document.createDocumentFragment();
    filteredSheets.forEach((sheet) => {
        fragment.appendChild(createSheetCard(sheet));
    });
    sheetsContainer.appendChild(fragment);
}

// 創建樂譜卡片
function createSheetCard(sheet) {
    const card = document.createElement('div');
    card.className = 'sheet-card';
    card.dataset.filename = sheet.filename;

    const title = sheet.title || '未命名歌曲';
    const artist = sheet.artist || '未知演唱者';
    const isBookmarked = sheet.bookmarked ? 'bookmarked' : '';
    const imageUrl = sheet.image || '';
    const tagsHtml = sheet.tags && sheet.tags.length
        ? `<div class="sheet-tags">${sheet.tags.map((tag) => `<span class="sheet-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';
    const imageHtml = imageUrl
        ? `<img class="sheet-card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />`
        : '';

    card.innerHTML = `
        <div class="sheet-card-image-container">${imageHtml}</div>
        <div class="sheet-card-content">
            <div class="sheet-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
            <div class="sheet-artist" title="${escapeHtml(artist)}">${escapeHtml(artist)}</div>
            ${tagsHtml}
        </div>
        <div class="sheet-card-top-actions">
            <div class="top-icon edit-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" ><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </div>
            <div class="top-icon bookmark-icon ${isBookmarked}">
                <svg viewBox="0 0 24 24"><path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h11A1.5 1.5 0 0 1 19 3.5v18.21l-6.22-4.443a1.5 1.5 0 0 0-1.56 0L5 21.71V3.5Z"></path></svg>
            </div>
        </div>
    `;

    return card;
}

// 依模式跳轉閱讀或編輯
async function navigateToSheet(filename, mode) {
    try {
        const sheet = await fetchSheet(filename);
        sessionStorage.setItem('currentSheetContent', sheet.content || '');
        sessionStorage.setItem('currentFilename', sheet.filename);
        window.location.href = mode === 'editor' ? 'editor.html' : 'reader.html';
    } catch (error) {
        console.error('載入樂譜失敗:', error);
        alert(error.message || '載入樂譜失敗');
    }
}



// 更新狀態
export function updateStatus() {
    const total = currentSheets.length;
    const filtered = filteredSheets.length;
    const searchValue = searchInput.value.trim();
    const activeFilters = [];

    if (showBookmarksOnly) {
        activeFilters.push('我的書籤');
    }
    if (searchValue) {
        activeFilters.push(`搜尋: ${searchValue}`);
    }
    if (selectedTags.size > 0) {
        activeFilters.push(`${selectedTags.size} 個標籤`);
    }

    if (searchValue || selectedTags.size > 0 || showBookmarksOnly) {
        sheetCount.textContent = `${filtered} / ${total} 首樂譜`;
    } else {
        sheetCount.textContent = `${total} 首樂譜`;
    }

    if (statusFilters) {
        const hasActiveFilters = activeFilters.length > 0;
        statusFilters.textContent = hasActiveFilters ? activeFilters.join(' ・ ') : '';
        statusFilters.classList.toggle('hidden', !hasActiveFilters);
    }

    if (clearTagsBtn) {
        clearTagsBtn.classList.toggle('hidden', activeFilters.length === 0);
    }

    if (libraryFilterBtn) {
        libraryFilterBtn.classList.toggle('active', selectedTags.size > 0);
    }
}

// 顯示空狀態
export function showEmptyState() {
    sheetsContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

// 隱藏空狀態
function hideEmptyState() {
    sheetsContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

// 根據歌曲數量排序並渲染標籤按鈕
export function renderTagButtons() {
    if (!normalTagButtons || !artistTagButtons) return;

    normalTagButtons.innerHTML = '';
    artistTagButtons.innerHTML = '';

    const sortFn = (a, b) => {
        if (b[1] !== a[1]) {
            return b[1] - a[1]; // 按數量降序
        }
        return a[0].localeCompare(b[0]); // 按名稱升序
    };

    const createButton = (tag, count) => {
        const button = document.createElement('button');
        button.className = `tag-btn ${selectedTags.has(tag) ? 'active' : ''}`;
        button.innerHTML = `
            <span class="tag-btn-label">${tag}</span>
            <span class="tag-btn-count">${count}</span>
        `;
        button.title = `${tag} ( ${count} )`;
        button.setAttribute('aria-pressed', selectedTags.has(tag) ? 'true' : 'false');
        button.onclick = () => toggleTag(tag);
        return button;
    };

    const sortedNormalTags = Array.from(normalTagCounts.entries()).sort(sortFn);
    const sortedArtistTags = Array.from(artistTagCounts.entries()).sort(sortFn);

    const normalFragment = document.createDocumentFragment();
    sortedNormalTags.forEach(([tag, count]) => {
        normalFragment.appendChild(createButton(tag, count));
    });
    const artistFragment = document.createDocumentFragment();
    sortedArtistTags.forEach(([tag, count]) => {
        artistFragment.appendChild(createButton(tag, count));
    });
    normalTagButtons.appendChild(normalFragment);
    artistTagButtons.appendChild(artistFragment);
}

// 切換標籤選擇
function toggleTag(tag) {
    if (selectedTags.has(tag)) {
        deleteSelectedTag(tag);
    } else {
        addSelectedTag(tag);
    }

    renderTagButtons();
    filterSheets();
    renderSheets();
    updateStatus();
    saveLibraryPrefs();
}

// 清除所有標籤篩選
function clearAllTags() {
    clearSelectedTags();
    if (searchInput) {
        searchInput.value = '';
    }
    if (showBookmarksOnly) {
        setShowBookmarksOnly(false);
        if (showBookmarksBtn) {
            showBookmarksBtn.classList.remove('active');
            showBookmarksBtn.setAttribute('aria-pressed', 'false');
        }
    }
    renderTagButtons();
    filterSheets();
    renderSheets();
    updateStatus();
    saveLibraryPrefs();
}

// 切換書籤篩選
function toggleBookmarkFilter() {
    const isActive = toggleShowBookmarksOnly();
    showBookmarksBtn.classList.toggle('active', isActive);
    showBookmarksBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

    // 重新篩選和渲染
    filterSheets();
    renderSheets();
    updateStatus();
    saveLibraryPrefs();
}

// 處理搜尋
function handleSearch(e) {
    filterSheets();
    renderSheets();
    updateStatus();
    saveLibraryPrefs();
}

async function onImportSuccess(processedCount) {
    if (importUrlModal) closeModal(importUrlModal);
    if (urlTextarea) urlTextarea.value = '';
    await loadSheetLibrary();
    filterSheets();
    renderSheets();
    renderTagButtons();
    updateStatus();
    alert(`已導入 ${processedCount} 個網址。請在樂譜庫中點擊該樂譜前往演奏。`);
}

async function handleImportFromUrl() {
    const urlText = (urlTextarea && urlTextarea.value) ? urlTextarea.value.trim() : '';
    if (!urlText) {
        alert('請貼上網址');
        return;
    }
    const urls = urlText.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) {
        alert('請貼上有效的網址');
        return;
    }
    try {
        if (window.electronAPI?.importFromUrl) {
            const result = await window.electronAPI.importFromUrl(urls);
            if (result && result.success !== false) {
                await onImportSuccess(result.processed ?? urls.length);
            } else {
                alert(result?.error || '導入失敗');
            }
            return;
        }
        const response = await fetch(API_BASE + '/api/import-from-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls }),
        });
        const result = await response.json();
        if (result.success) {
            await onImportSuccess(result.processed);
        } else {
            alert(result.error || '導入失敗');
        }
    } catch (e) {
        console.error(e);
        alert('導入失敗');
    }
}

async function handleSelectSheetsFolder() {
    if (!window.electronAPI?.selectSheetsFolder) {
        alert('瀏覽器模式請將舊樂譜放在專案 sheets 資料夾，重啟伺服器即可自動匯入。');
        return;
    }
    try {
        const result = await window.electronAPI.selectSheetsFolder();
        if (!result || result.canceled) return;
        if (result.success === false) {
            alert(result.error || '匯入失敗，請稍後再試。');
            return;
        }
        updateEmptyMessage(result.path);
        await loadSheetLibrary();
        filterSheets();
        renderSheets();
        renderTagButtons();
        updateStatus();
        const count = typeof result.imported === 'number' ? result.imported : 0;
        alert(count > 0 ? `已從資料夾匯入 ${count} 首樂譜。` : '該資料夾沒有可匯入的 .txt / .gtab 樂譜。');
    } catch (error) {
        console.error('從資料夾匯入失敗:', error);
        alert('從資料夾匯入失敗，請稍後再試。');
    }
}

function openLibraryFilterDrawer() {
    if (!libraryFilterDrawer) return;
    libraryFilterDrawer.classList.add('is-open');
    libraryFilterDrawer.setAttribute('aria-hidden', 'false');
    libraryFilterBtn?.setAttribute('aria-expanded', 'true');
}

function closeLibraryFilterDrawer() {
    if (!libraryFilterDrawer) return;
    libraryFilterDrawer.classList.remove('is-open');
    libraryFilterDrawer.setAttribute('aria-hidden', 'true');
    libraryFilterBtn?.setAttribute('aria-expanded', 'false');
}

export function setupEventListeners() {
    if (sortBySelect) initCustomSelect(sortBySelect);
    decorateSortTrigger();
    syncToolbarPosition();
    syncLibraryHeaderOffset();
    window.addEventListener('resize', () => {
        syncToolbarPosition();
        syncLibraryHeaderOffset();
        if (libraryView == null) applyLibraryView();
        if (window.innerWidth > MOBILE_BREAKPOINT) {
            closeLibraryFilterDrawer();
        }
    });
    libraryViewBtn?.addEventListener('click', toggleLibraryView);
    bindSheetsContainer();
    applyLibraryView();
    document.querySelector('.back-to-top')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.setTimeout(syncLibraryHeaderOffset, 0);
    window.setTimeout(syncLibraryHeaderOffset, 250);
    syncSheetsPathHint();

    searchInput.addEventListener('input', (e) => {
        syncSearchExpanded();
        handleSearch(e);
    });
    searchInput.addEventListener('blur', () => {
        window.setTimeout(syncSearchExpanded, 120);
    });
    syncSearchExpanded();
    if (clearTagsBtn) {
        clearTagsBtn.addEventListener('click', clearAllTags);
    }
    if (sortBySelect) {
        sortBySelect.addEventListener('change', (e) => {
            setSortBy(e.target.value);
            filterSheets();
            renderSheets();
            updateStatus();
            saveLibraryPrefs();
        });
    }
    if (showBookmarksBtn) {
        showBookmarksBtn.addEventListener('click', toggleBookmarkFilter);
    }
    libraryFilterBtn?.addEventListener('click', openLibraryFilterDrawer);
    libraryFilterBackdrop?.addEventListener('click', closeLibraryFilterDrawer);
    libraryFilterClose?.addEventListener('click', closeLibraryFilterDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && libraryFilterDrawer?.classList.contains('is-open')) {
            closeLibraryFilterDrawer();
        }
    });

    if (newBtn && newMenu) {
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = newMenu.classList.toggle('visible');
            newMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            newBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        newMenu.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => {
            newMenu.classList.remove('visible');
            newMenu.setAttribute('aria-hidden', 'true');
            newBtn.setAttribute('aria-expanded', 'false');
        });
        newMenu.querySelectorAll('.library-new-menu-item').forEach((item) => {
            item.addEventListener('click', () => {
                const action = item.getAttribute('data-action');
                newMenu.classList.remove('visible');
                newMenu.setAttribute('aria-hidden', 'true');
                newBtn.setAttribute('aria-expanded', 'false');
                if (action === 'new') {
                    sessionStorage.setItem('currentSheetContent', '');
                    sessionStorage.removeItem('currentFilename');
                    window.location.href = 'editor.html';
                } else if (action === 'importUrl') {
                    if (importUrlModal) openModal(importUrlModal);
                } else if (action === 'importFile' && libraryImportFile) {
                    libraryImportFile.click();
                } else if (action === 'importFolder') {
                    handleSelectSheetsFolder();
                }
            });
        });
    }

    if (libraryImportFile) {
        libraryImportFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                sessionStorage.setItem('currentSheetContent', evt.target.result);
                sessionStorage.setItem('currentFilename', file.name);
                window.location.href = 'reader.html';
            };
            reader.readAsText(file, 'utf-8');
            e.target.value = '';
        });
    }

    if (importUrlConfirmBtn) {
        importUrlConfirmBtn.addEventListener('click', handleImportFromUrl);
    }
    if (importUrlCancelBtn && importUrlModal) {
        importUrlCancelBtn.addEventListener('click', () => closeModal(importUrlModal));
    }
    if (importUrlModal) {
        importUrlModal.addEventListener('click', (e) => {
            if (e.target === importUrlModal) closeModal(importUrlModal);
        });
    }
}