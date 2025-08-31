        // 樂譜庫狀態
        let currentSheets = [];
        let filteredSheets = [];
        let isLoading = false;
        let normalTagCounts = new Map();
        let artistTagCounts = new Map();
        let selectedTags = new Set();

        // DOM 元素
        const sheetsContainer = document.getElementById('sheetsContainer');
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('loadingState');
        const localFileState = document.getElementById('localFileState');
        const statusBar = document.getElementById('statusBar');
        const statusText = document.getElementById('statusText');
        const sheetCount = document.getElementById('sheetCount');
        const searchInput = document.getElementById('searchInput');
        const normalTagButtons = document.getElementById('normalTagButtons');
        const artistTagButtons = document.getElementById('artistTagButtons');
        const clearTagsBtn = document.getElementById('clearTagsBtn');

        // 初始化
        async function init() {
            setupEventListeners();
            await loadSheetLibrary();
        }



        // 設置事件監聽器
        function setupEventListeners() {
            searchInput.addEventListener('input', handleSearch);
            if (clearTagsBtn) {
                clearTagsBtn.addEventListener('click', clearAllTags);
            }
        }

        // GitHub API 掃描樂譜檔案
        async function scanGitHubSheets() {
            try {
                // 檢查是否為 GitHub Pages
                const isGitHubPages = window.location.hostname.includes('github.io');
                
                if (isGitHubPages) {
                    // 從 URL 推斷 GitHub repo 信息
                    const hostname = window.location.hostname;
                    const pathParts = window.location.pathname.split('/').filter(p => p);
                    
                    let username, repoName;
                    
                    if (hostname.endsWith('.github.io')) {
                        username = hostname.split('.')[0];
                        repoName = pathParts[0] || (username + '.github.io');
                    }
                    
                    if (username && repoName) {
                        const apiUrl = `https://api.github.com/repos/${username}/${repoName}/contents/sheets`;
                        console.log(`嘗試 GitHub API: ${apiUrl}`);
                        
                        const response = await fetch(apiUrl);
                        if (response.ok) {
                            const files = await response.json();
                            const sheetFiles = files
                                .filter(file => file.type === 'file' && (file.name.endsWith('.txt') || file.name.endsWith('.gtab')))
                                .map(file => file.name);
                            
                            console.log(`GitHub API 找到 ${sheetFiles.length} 個檔案`);
                            return sheetFiles;
                        } else {
                            console.log(`GitHub API 回應錯誤: ${response.status}`);
                        }
                    }
                }
                
                return [];
            } catch (error) {
                console.log('GitHub API 掃描失敗:', error);
                return [];
            }
        }

        // 自動掃描 sheets 資料夾
        async function autoScanSheetsFolder() {
            try {
                // 方法1: 嘗試使用 Node.js API
                try {
                    const response = await fetch('./api/sheets');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.sheets) {
                            console.log(`Node.js API 掃描完成：${data.count} 首樂譜`);
                            return data.sheets;
                        }
                    }
                } catch (apiError) {
                    console.log('Node.js API 掃描失敗，嘗試其他方法:', apiError);
                }

                // 方法2: 嘗試使用 PHP 腳本掃描
                try {
                    const response = await fetch('./sheets/index.php');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.sheets) {
                            console.log(`PHP 腳本掃描完成：${data.count} 首樂譜`);
                            return data.sheets;
                        }
                    }
                } catch (phpError) {
                    console.log('PHP 腳本掃描失敗，嘗試其他方法:', phpError);
                }

                // 方法3: 嘗試使用 GitHub API 掃描
                const githubFiles = await scanGitHubSheets();
                if (githubFiles.length > 0) {
                    const sheets = [];
                    for (const filename of githubFiles) {
                        try {
                            const response = await fetch(`./sheets/${encodeURIComponent(filename)}`);
                            if (response.ok) {
                                const content = await response.text();
                                const meta = parseSheetMeta(content);

                                sheets.push({
                                    filename: filename,
                                    title: meta.title || filename.replace(/\.(txt|gtab)$/, ''),
                                    artist: meta.artist || '',
                                    tags: meta.tags || [],
                                    content: content,
                                    lastModified: Date.now(),
                                    addedDate: new Date().toISOString()
                                });
                            }
                        } catch (error) {
                            console.log(`無法讀取檔案 ${filename}:`, error.message);
                        }
                    }

                    if (sheets.length > 0) {
                        console.log(`GitHub 掃描完成：${sheets.length} 首樂譜`);
                        return sheets;
                    }
                }

            } catch (error) {
                console.log('讀取失敗:', error);
            }

            return [];
        }

        // 載入樂譜庫 - 每次都重新掃描
        async function loadSheetLibrary() {
            showLoadingState();

            try {
                // 每次都重新掃描 sheets 資料夾
                let sheets = await autoScanSheetsFolder();

                currentSheets = sheets;
                filteredSheets = [...currentSheets];
                
                // 收集所有標籤
                collectTags();
                
                // 渲染標籤按鈕
                renderTagButtons();
                
                renderSheets();
                updateStatus();

                if (sheets.length > 0) {
                    statusText.textContent = `讀取完成`;
                } else {
                    statusText.textContent = '未找到樂譜檔案';
                    showEmptyState();
                }
            } catch (error) {
                console.error('掃描樂譜庫失敗:', error);
                statusText.textContent = '讀取失敗';
                showEmptyState();
            } finally {
                hideLoadingState();
            }
        }

        // 處理搜尋
        function handleSearch(e) {
            filterSheets();
        }



        // 顯示載入狀態
        function showLoadingState() {
            sheetsContainer.style.display = 'none';
            emptyState.style.display = 'none';
            loadingState.style.display = 'block';
        }

        // 隱藏載入狀態
        function hideLoadingState() {
            loadingState.style.display = 'none';
        }

        // 渲染樂譜卡片
        function renderSheets() {
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
                <div class="sheet-icon">${iconText}</div>
                <div class="sheet-title" title="${sheet.title}">${sheet.title || '未命名歌曲'}</div>
                <div class="sheet-artist" title="${sheet.artist}">${sheet.artist || '未知演唱者'}</div>
                ${sheet.tags && sheet.tags.length > 0 ? `
                    <div class="sheet-tags">
                        ${sheet.tags.map(tag => `<span class="sheet-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
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
                const encodedContent = encodeURIComponent(sheet.content);
                const encodedFilename = encodeURIComponent(filename);
                const url = `editor.html?content=${encodedContent}&filename=${encodedFilename}`;
                window.open(url, '_blank');
            }
        }

        // 更新狀態
        function updateStatus() {
            const total = currentSheets.length;
            const filtered = filteredSheets.length;

            if (searchInput.value.trim() || selectedTags.size > 0) {
                sheetCount.textContent = `${filtered} / ${total} 首樂譜`;
            } else {
                sheetCount.textContent = `${total} 首樂譜`;
            }
        }



        // 顯示空狀態
        function showEmptyState() {
            sheetsContainer.style.display = 'none';
            emptyState.style.display = 'block';
            localFileState.style.display = 'none';
        }

        // 隱藏空狀態
        function hideEmptyState() {
            sheetsContainer.style.display = 'grid';
            emptyState.style.display = 'none';
            localFileState.style.display = 'none';
        }

        // 顯示本地檔案狀態
        function showLocalFileState() {
            sheetsContainer.style.display = 'none';
            emptyState.style.display = 'none';
            localFileState.style.display = 'block';
        }

        // ==================== 標籤分類功能 ====================

        // 收集所有標籤並計數
        function collectTags() {
            normalTagCounts.clear();
            artistTagCounts.clear();

            currentSheets.forEach(sheet => {
                // 收集普通標籤
                if (sheet.tags && Array.isArray(sheet.tags)) {
                    sheet.tags.forEach(tag => {
                        if (tag) {
                            normalTagCounts.set(tag, (normalTagCounts.get(tag) || 0) + 1);
                        }
                    });
                }
                // 收集作者標籤
                if (sheet.artist) {
                    artistTagCounts.set(sheet.artist, (artistTagCounts.get(sheet.artist) || 0) + 1);
                }
            });
        }

        // 根據歌曲數量排序並渲染標籤按鈕
        function renderTagButtons() {
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
                selectedTags.delete(tag);
            } else {
                selectedTags.add(tag);
            }
            
            renderTagButtons();
            filterSheets();
        }

        // 清除所有標籤篩選
        function clearAllTags() {
            selectedTags.clear();
            renderTagButtons();
            filterSheets();
        }

        // 篩選樂譜
        function filterSheets() {
            const searchQuery = searchInput.value.toLowerCase().trim();
            
            filteredSheets = currentSheets.filter(sheet => {
                // 搜尋篩選
                const matchesSearch = !searchQuery || 
                    sheet.title.toLowerCase().includes(searchQuery) ||
                    sheet.artist.toLowerCase().includes(searchQuery) ||
                    sheet.filename.toLowerCase().includes(searchQuery) ||
                    (sheet.tags && sheet.tags.some(tag => tag.toLowerCase().includes(searchQuery)));
                
                // 標籤篩選 (包含作者)
                const allSheetTags = [...(sheet.tags || []), sheet.artist].filter(Boolean);
                const matchesTags = selectedTags.size === 0 || 
                    allSheetTags.some(tag => selectedTags.has(tag));
                
                return matchesSearch && matchesTags;
            });
            
            renderSheets();
            updateStatus();
        }

        
        // 更新狀態
        function updateStatus() {
            const total = currentSheets.length;
            const filtered = filteredSheets.length;

            if (searchInput.value.trim() || selectedTags.size > 0) {
                sheetCount.textContent = `${filtered} / ${total} 首樂譜`;
            } else {
                sheetCount.textContent = `${total} 首樂譜`;
            }
        }

        // 頁面載入完成後初始化
        window.addEventListener('load', init);