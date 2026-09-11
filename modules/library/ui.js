import { filteredSheets, currentSheets, selectedTags, normalTagCounts, artistTagCounts, addSelectedTag, deleteSelectedTag, clearSelectedTags, setSortBy, setShowBookmarksOnly, showBookmarksOnly, toggleShowBookmarksOnly } from './state.js';
import { filterSheets, updateBookmark, loadSheetLibrary } from './data.js';
import { saveLibraryPrefs } from './persist.js';
import { API_BASE } from '../config/api.js';
import { assetUrl } from '../config/paths.js';
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
const selectSheetsFolderBtn = document.getElementById('selectSheetsFolderBtn');
const newBtn = document.getElementById('newBtn');
const newMenu = document.getElementById('newMenu');
const emptyMessage = document.getElementById('emptyMessage');
const libraryHeader = document.querySelector('.library-header');
const libraryImportFile = document.getElementById('libraryImportFile');
const libraryFilterDrawer = document.getElementById('libraryFilterDrawer');
const libraryFilterBtn = document.getElementById('libraryFilterBtn');
const libraryFilterBackdrop = document.getElementById('libraryFilterBackdrop');
const libraryFilterClose = document.getElementById('libraryFilterClose');
const libraryToolbarControls = document.querySelector('.library-toolbar-controls');
const libraryHeaderRight = document.querySelector('.library-header-right');
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
    if (!libraryToolbarControls || !libraryHeaderTop || !libraryHeaderRight) return;
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    if (isMobile) {
        // 手機：確保 toolbar 在 drawer 的 aside 內（sidebar-section-tags 前面）
        const sidebar = libraryFilterDrawer?.querySelector('.sidebar');
        const tagsSection = libraryFilterDrawer?.querySelector('.sidebar-section-tags');
        if (sidebar && tagsSection && libraryToolbarControls.parentElement !== sidebar) {
            sidebar.insertBefore(libraryToolbarControls, tagsSection);
        }
    } else {
        // 桌面：把 toolbar 放回 header-top，在 library-header-right 前面
        if (libraryToolbarControls.parentElement !== libraryHeaderTop) {
            libraryHeaderTop.insertBefore(libraryToolbarControls, libraryHeaderRight);
        }
    }
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

// 渲染樂譜卡片
export function renderSheets() {
    sheetsContainer.innerHTML = '';

    if (filteredSheets.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();

    filteredSheets.forEach(sheet => {
        const card = createSheetCard(sheet);
        sheetsContainer.appendChild(card);
    });
}

// 創建樂譜卡片
function createSheetCard(sheet) {
    const card = document.createElement('div');
    card.className = 'sheet-card';

    const isBookmarked = sheet.bookmarked ? 'bookmarked' : '';
    const imageUrl = sheet.image
      ? (/^(https?:|data:|blob:)/i.test(sheet.image) ? sheet.image : assetUrl(sheet.image.startsWith('/') ? sheet.image : '/' + sheet.image))
      : assetUrl('/assets/guitar4.jpg');

    card.innerHTML = `
        <div class="sheet-card-image-container">
            <img class="sheet-card-image" src="${imageUrl}" alt="${sheet.title}" />
            <div class="sheet-card-top-actions">
                <div class="top-icon edit-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" ><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
               </div>
                <div class="top-icon bookmark-icon ${isBookmarked}">
                    <svg viewBox="0 0 24 24"><path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h11A1.5 1.5 0 0 1 19 3.5v18.21l-6.22-4.443a1.5 1.5 0 0 0-1.56 0L5 21.71V3.5Z"></path></svg>
                </div>
            </div>
        </div>
        <div class="sheet-card-content">
            <div class="sheet-title" title="${sheet.title}">${sheet.title || '未命名歌曲'}</div>
            <div class="sheet-artist" title="${sheet.artist}">${sheet.artist || '未知演唱者'}</div>
            ${sheet.tags && sheet.tags.length > 0 ? `
                <div class="sheet-tags">
                    ${sheet.tags.map(tag => `<span class="sheet-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;

    // Event listeners
    const editBtn = card.querySelector('.edit-icon');
    const bookmarkBtn = card.querySelector('.bookmark-icon');

    card.addEventListener('click', () => navigateToSheet(sheet.filename, 'reader'));
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateToSheet(sheet.filename, 'editor');
    });
    
    bookmarkBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent card click event
        const isCurrentlyBookmarked = bookmarkBtn.classList.contains('bookmarked');
        const success = await updateBookmark(sheet.filename, !isCurrentlyBookmarked);
        if (success) {
            bookmarkBtn.classList.toggle('bookmarked');
        }
    });

    return card;
}

// 依模式跳轉閱讀或編輯
function navigateToSheet(filename, mode) {
    const sheet = currentSheets.find(s => s.filename === filename);
    if (!sheet) return;
    sessionStorage.setItem('currentSheetContent', sheet.content);
    sessionStorage.setItem('currentFilename', sheet.filename);
    window.location.href = mode === 'editor' ? 'editor.html' : 'reader.html';
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

    // 渲染普通標籤
    sortedNormalTags.forEach(([tag, count]) => {
        normalTagButtons.appendChild(createButton(tag, count));
    });

    // 渲染作者標籤
    sortedArtistTags.forEach(([tag, count]) => {
        artistTagButtons.appendChild(createButton(tag, count));
    });
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
    syncToolbarPosition();
    syncLibraryHeaderOffset();
    window.addEventListener('resize', () => {
        syncToolbarPosition();
        syncLibraryHeaderOffset();
        if (window.innerWidth > MOBILE_BREAKPOINT) {
            closeLibraryFilterDrawer();
        }
    });
    window.setTimeout(syncLibraryHeaderOffset, 0);
    window.setTimeout(syncLibraryHeaderOffset, 250);
    syncSheetsPathHint();

    searchInput.addEventListener('input', handleSearch);
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
    if (selectSheetsFolderBtn) {
        selectSheetsFolderBtn.addEventListener('click', handleSelectSheetsFolder);
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
            newMenu.classList.toggle('visible');
            newMenu.setAttribute('aria-hidden', newMenu.classList.contains('visible') ? 'false' : 'true');
        });
        newMenu.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => {
            newMenu.classList.remove('visible');
            newMenu.setAttribute('aria-hidden', 'true');
        });
        newMenu.querySelectorAll('.library-new-menu-item').forEach((item) => {
            item.addEventListener('click', () => {
                const action = item.getAttribute('data-action');
                newMenu.classList.remove('visible');
                newMenu.setAttribute('aria-hidden', 'true');
                if (action === 'new') {
                    sessionStorage.setItem('currentSheetContent', '');
                    sessionStorage.removeItem('currentFilename');
                    window.location.href = 'editor.html';
                } else if (action === 'importUrl') {
                    if (importUrlModal) openModal(importUrlModal);
                } else if (action === 'importFile' && libraryImportFile) {
                    libraryImportFile.click();
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