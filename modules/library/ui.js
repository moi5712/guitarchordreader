import { filteredSheets, currentSheets, selectedTags, normalTagCounts, artistTagCounts, addSelectedTag, deleteSelectedTag, clearSelectedTags, setSortBy } from './state.js';
import { filterSheets } from './data.js';

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

    // 根據檔案類型選擇圖示文字
    const iconText = sheet.filename.endsWith('.gtab') ? 'TAB' : 'TXT';

    card.innerHTML = `
        <div class="sheet-card-content">
            <div class="sheet-icon">${iconText}</div>
            <div class="sheet-title" title="${sheet.title}">${sheet.title || '未命名歌曲'}</div>
            <div class="sheet-artist" title="${sheet.artist}">${sheet.artist || '未知演唱者'}</div>
            ${sheet.tags && sheet.tags.length > 0 ? `
                <div class="sheet-tags">
                    ${sheet.tags.map(tag => `<span class="sheet-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
        </div>
        <div class="sheet-actions">
            <button class="sheet-btn open-btn">打開</button>
            <button class="sheet-btn edit-btn">編輯</button>
        </div>
    `;

    // 使用事件監聽器避免檔案名稱中特殊字符的問題
    const openBtn = card.querySelector('.open-btn');
    const editBtn = card.querySelector('.edit-btn');

    openBtn.addEventListener('click', () => openSheet(sheet.filename));
    editBtn.addEventListener('click', () => editSheet(sheet.filename));

    return card;
}

// 開啟樂譜
function openSheet(filename) {
    const sheet = currentSheets.find(s => s.filename === filename);
    if (sheet) {
        const encodedContent = encodeURIComponent(sheet.content);
        const url = `reader.html?content=${encodedContent}`;
        window.open(url, '_blank');
    }
}

// 編輯樂譜
function editSheet(filename) {
    const sheet = currentSheets.find(s => s.filename === filename);
    if (sheet) {
        // Save data to sessionStorage before opening the new tab
        sessionStorage.setItem('sheetToEdit_content', sheet.content);
        sessionStorage.setItem('sheetToEdit_filename', sheet.filename);
        window.open('editor.html', '_blank');
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
        button.title = `${tag} (${count} 首)`;
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
}