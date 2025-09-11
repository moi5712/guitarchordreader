import { filteredSheets, currentSheets, selectedTags, normalTagCounts, artistTagCounts, addSelectedTag, deleteSelectedTag, clearSelectedTags, setSortBy, toggleShowBookmarksOnly } from './state.js';
import { filterSheets, updateBookmark } from './data.js';

// DOM 元素
const sheetsContainer = document.getElementById('sheetsContainer');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const statusBar = document.getElementById('statusBar');
const sheetCount = document.getElementById('sheetCount');
const searchInput = document.getElementById('searchInput');
const normalTagButtons = document.getElementById('normalTagButtons');
const artistTagButtons = document.getElementById('artistTagButtons');
const clearTagsBtn = document.getElementById('clearTagsBtn');
const sortBySelect = document.getElementById('sortBy');
const showBookmarksBtn = document.getElementById('showBookmarksBtn');

// 顯示載入狀態
export function showLoadingState() {
    sheetsContainer.style.display = 'none';
    emptyState.style.display = 'none';
    loadingState.style.display = 'block';
}

// 隱藏載入狀態
export function hideLoadingState() {
    loadingState.style.display = 'none';
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
    const imageUrl = sheet.image ? sheet.image : 'guitar4.jpg';

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

    card.addEventListener('click', () => openSheet(sheet.filename));
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editSheet(sheet.filename);
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

// 開啟樂譜
function openSheet(filename) {
    const sheet = currentSheets.find(s => s.filename === filename);
    if (sheet) {
        // 使用統一鍵：currentSheetContent / currentFilename
        sessionStorage.setItem('currentSheetContent', sheet.content);
        sessionStorage.setItem('currentFilename', sheet.filename);
        window.location.href = 'reader.html';
    }
}

// 編輯樂譜
function editSheet(filename) {
    const sheet = currentSheets.find(s => s.filename === filename);
    if (sheet) {
        // 使用統一鍵：currentSheetContent / currentFilename
        sessionStorage.setItem('currentSheetContent', sheet.content);
        sessionStorage.setItem('currentFilename', sheet.filename);
        window.location.href = 'editor.html';
    }
}



// 更新狀態
export function updateStatus() {
    const total = currentSheets.length;
    const filtered = filteredSheets.length;

    if (searchInput.value.trim() || selectedTags.size > 0) {
        sheetCount.textContent = `${filtered} / ${total} 首樂譜`;
    } else {
        sheetCount.textContent = `${total} 首樂譜`;
    }
}

// 顯示空狀態
export function showEmptyState() {
    sheetsContainer.style.display = 'none';
    emptyState.style.display = 'block';
}

// 隱藏空狀態
function hideEmptyState() {
    sheetsContainer.style.display = 'grid';
    emptyState.style.display = 'none';
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
        button.textContent = tag;
        button.title = `${tag} ( ${count} )`;
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
}

// 清除所有標籤篩選
function clearAllTags() {
    clearSelectedTags();
    renderTagButtons();
    filterSheets();
    renderSheets();
    updateStatus();
}

// 切換書籤篩選
function toggleBookmarkFilter() {
    const isActive = toggleShowBookmarksOnly();
    showBookmarksBtn.classList.toggle('active', isActive);

    // 重新篩選和渲染
    filterSheets();
    renderSheets();
    updateStatus();
}

// 處理搜尋
function handleSearch(e) {
    filterSheets();
    renderSheets();
    updateStatus();
}

export function setupEventListeners() {
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
        });
    }
    if (showBookmarksBtn) {
        showBookmarksBtn.addEventListener('click', toggleBookmarkFilter);
    }
}