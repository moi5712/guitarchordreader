// 編輯器狀態
      let editorHistory = [];
      let historyIndex = -1;

      // 編輯器功能
      function saveToHistory() {
        const content = document.getElementById("editorTextarea").value;
        if (historyIndex < editorHistory.length - 1) {
          editorHistory = editorHistory.slice(0, historyIndex + 1);
        }
        editorHistory.push(content);
        if (editorHistory.length > 50) {
          editorHistory.shift();
        } else {
          historyIndex++;
        }
      }

      function undo() {
        if (historyIndex > 0) {
          historyIndex--;
          document.getElementById("editorTextarea").value =
            editorHistory[historyIndex];
        }
      }

      function redo() {
        if (historyIndex < editorHistory.length - 1) {
          historyIndex++;
          document.getElementById("editorTextarea").value =
            editorHistory[historyIndex];
        }
      }

      function insertAtCursor(text) {
        const textarea = document.getElementById("editorTextarea");
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        saveToHistory();
        textarea.value =
          value.substring(0, start) + text + value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }

      function insertChord(chord) {
        insertAtCursor(`[${chord}]`);
      }

      function insertSection(sectionType) {
        insertAtCursor(`\n[${sectionType}]\n`);
      }

      async function updateMetaInfo() {
        const title = document.getElementById("songTitle").value;
        const artist = document.getElementById("songArtist").value;
        const key = document.getElementById("songKey").value;
        const bpm = document.getElementById("songBpm").value;
        const capo = document.getElementById("songCapo").value;

        let metaText = "";
        if (title) metaText += `#title: ${title}\n`;
        if (artist) metaText += `#artist: ${artist}\n`;
        if (key) metaText += `#key: ${key}\n`;
        if (bpm) metaText += `#bpm: ${bpm}\n`;
        if (capo) metaText += `#capo: ${capo}\n`;

        if (metaText) {
          const textarea = document.getElementById("editorTextarea");
          const currentContent = textarea.value;
          const lines = currentContent.split("\n");
          const nonMetaLines = lines.filter((line) => !line.startsWith("#"));

          saveToHistory();
          textarea.value = metaText + "\n" + nonMetaLines.join("\n");
        }
      }




      async function newDocument() {
        if (await showConfirm("確定要新建文件嗎？未保存的內容將會丟失。")) {
          saveToHistory();
          const emptyContent = "#title: \n#artist: \n\n[verse]\n";
          document.getElementById("editorTextarea").value = emptyContent;
          sessionStorage.setItem("currentSheetContent", emptyContent);
          ["songTitle", "songArtist", "songKey", "songBpm", "songCapo"].forEach(
            (id) => {
              document.getElementById(id).value = "";
            }
          );
        }
      }

      async function exportDocument() {
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

      function importDocument(text) {
        saveToHistory();
        document.getElementById("editorTextarea").value = text;
        sessionStorage.setItem("currentSheetContent", text); // 更新暫存區
        const meta = parseSheetMeta(text);

        if (meta.title) document.getElementById("songTitle").value = meta.title;
        if (meta.artist)
          document.getElementById("songArtist").value = meta.artist;
        if (meta.key) document.getElementById("songKey").value = meta.key;
        if (meta.bpm) document.getElementById("songBpm").value = meta.bpm;
        if (meta.capo) document.getElementById("songCapo").value = meta.capo;

        // 載入文件中的自定義和弦
        loadCustomChordsFromText(text);
      }

      // 自定義和弦功能
      let customChords = {};

      function addCustomChord() {
        const chordName = document
          .getElementById("customChordName")
          .value.trim();
        const fret6 = parseInt(document.getElementById("fret6").value) || 0;
        const fret5 = parseInt(document.getElementById("fret5").value) || 0;
        const fret4 = parseInt(document.getElementById("fret4").value) || 0;
        const fret3 = parseInt(document.getElementById("fret3").value) || 0;
        const fret2 = parseInt(document.getElementById("fret2").value) || 0;
        const fret1 = parseInt(document.getElementById("fret1").value) || 0;

        if (!chordName) {
          showAlert("請輸入和弦名稱");
          return;
        }

        // 驗證指法 - 允許全部空弦
        const fingering = [fret6, fret5, fret4, fret3, fret2, fret1];
        const validFrets = fingering.filter((f) => f > 0);
        const hasValidInput = fingering.some((f) => f !== 0); // 至少有一個非空弦輸入

        if (!hasValidInput) {
          showAlert("請至少輸入一個有效的指法");
          return;
        }

        // 保存自定義和弦
        customChords[chordName] = fingering;
        localStorage.setItem("customChords", JSON.stringify(customChords));

        // 添加到樂譜中
        const textarea = document.getElementById("editorTextarea");
        const currentContent = textarea.value;
        const customChordLine = `@${chordName}: ${fingering.join(",")}`;

        // 檢查是否已經存在該和弦定義
        const lines = currentContent.split("\n");
        const existingIndex = lines.findIndex((line) =>
          line.trim().startsWith(`@${chordName}:`)
        );

        if (existingIndex >= 0) {
          lines[existingIndex] = customChordLine;
        } else {
          // 找到第一個非 meta 行，在其前面插入
          let insertIndex = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() && !lines[i].trim().startsWith("#")) {
              insertIndex = i;
              break;
            }
          }
          lines.splice(insertIndex, 0, customChordLine);
        }

        saveToHistory();
        textarea.value = lines.join("\n");

        // 清空輸入框
        document.getElementById("customChordName").value = "";
        document.getElementById("fret6").value = "";
        document.getElementById("fret5").value = "";
        document.getElementById("fret4").value = "";
        document.getElementById("fret3").value = "";
        document.getElementById("fret2").value = "";
        document.getElementById("fret1").value = "";

        // 更新自定義和弦列表
        renderCustomChords();
      }

      async function deleteCustomChord(chordName) {
        if (await showConfirm(`確定要刪除和弦 "${chordName}" 嗎？`)) {
          delete customChords[chordName];
          localStorage.setItem("customChords", JSON.stringify(customChords));

          // 從樂譜中移除該和弦定義
          const textarea = document.getElementById("editorTextarea");
          const currentContent = textarea.value;
          const lines = currentContent.split("\n");
          const filteredLines = lines.filter(
            (line) => !line.trim().startsWith(`@${chordName}:`)
          );

          saveToHistory();
          textarea.value = filteredLines.join("\n");

          renderCustomChords();
        }
      }

      function renderCustomChords() {
        const customChordGrid = document.getElementById("customChordGrid");
        customChordGrid.innerHTML = "";

        Object.keys(customChords).forEach((chordName) => {
          const btn = document.createElement("button");
          btn.className = "custom-chord-btn";
          btn.textContent = chordName;

          // 添加刪除按鈕
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-btn";
          deleteBtn.textContent = "×";
          deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            await deleteCustomChord(chordName);
          };
          btn.appendChild(deleteBtn);

          // 點擊插入和弦
          btn.onclick = () => insertChord(chordName);
          customChordGrid.appendChild(btn);
        });
      }

      function loadCustomChords() {
        const saved = localStorage.getItem("customChords");
        if (saved) {
          try {
            customChords = JSON.parse(saved);
            renderCustomChords();
          } catch (e) {
            console.log("無法載入自定義和弦");
          }
        }
      }

      function loadCustomChordsFromText(text) {
        const lines = text.split("\n");
        const newCustomChords = {};

        lines.forEach((line) => {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("@")) {
            const match = trimmedLine.match(/^@([^:]+):\s*(.*)$/);
            if (match) {
              const chordName = match[1].trim();
              const fingeringStr = match[2].trim();
              try {
                const fingering = fingeringStr.split(",").map((s) => {
                  const val = s.trim();
                  return val === "-1" ? -1 : parseInt(val);
                });

                if (
                  fingering.length === 6 &&
                  fingering.every(
                    (f) => Number.isInteger(f) && f >= -1 && f <= 12
                  )
                ) {
                  newCustomChords[chordName] = fingering;
                }
              } catch (e) {
                console.log(`解析指法失敗: ${line}`);
              }
            }
          }
        });

        // 合併新的自定義和弦
        customChords = { ...customChords, ...newCustomChords };
        localStorage.setItem("customChords", JSON.stringify(customChords));
        renderCustomChords();
      }

      // 儲存功能
      async function saveToSheetsFolder() {
        const content = document.getElementById("editorTextarea").value;
        if (!content.trim()) {
          alert("請先輸入樂譜內容");
          return;
        }

        let fullFilename;

        if (currentFilename) {
          // 如果有原始檔案名稱，詢問是否覆蓋
          const overwrite = confirm(`是否覆蓋原檔案 "${currentFilename}" ？\n點擊「確定」覆蓋，點擊「取消」另存新檔。`);

          if (overwrite) {
            fullFilename = currentFilename;
          } else {
            const filename = prompt("請輸入檔案名稱（不含副檔名）：");
            if (!filename) return;
            const extension = currentFilename.includes(".gtab") ? ".gtab" : ".txt";
            fullFilename = filename + extension;
          }
        } else {
          // 沒有原始檔案名稱，詢問新檔案名稱
          const filename = prompt("請輸入檔案名稱（不含副檔名）：");
          if (!filename) return;
          const extension = ".txt"; // 預設儲存為txt格式
          fullFilename = filename + extension;
        }

        try {
          const response = await fetch("/api/save-sheet", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename: fullFilename,
              content: content,
            }),
          });

          if (response.ok) {
            alert(`檔案已儲存：${fullFilename}`);
            // 更新當前檔案名稱
            currentFilename = fullFilename;
          } else {
            alert("儲存失敗");
          }
        } catch (error) {
          console.error("儲存錯誤:", error);
          alert("儲存失敗");
        }
      }

      // 全域變數儲存當前檔案名稱
      let currentFilename = null;

      // 初始化
      function init() {
        // 設置初始編輯模式
        document.body.classList.add("editor-mode");

        // 優先從 sessionStorage 恢復草稿，其次才從 URL 參數載入
        let initialContent = sessionStorage.getItem("currentSheetContent") || "";
        const urlParams = new URLSearchParams(window.location.search);
        const contentParam = urlParams.get('content');

        if (contentParam) {
            initialContent = decodeURIComponent(contentParam);
        }
        
        // 更新文本區和暫存區
        document.getElementById("editorTextarea").value = initialContent;
        sessionStorage.setItem("currentSheetContent", initialContent);

        // 從載入的內容更新歌曲資訊
        if (initialContent) {
            const meta = parseSheetMeta(initialContent);
            if (meta.title) document.getElementById("songTitle").value = meta.title;
            if (meta.artist) document.getElementById("songArtist").value = meta.artist;
            if (meta.key) document.getElementById("songKey").value = meta.key;
            if (meta.bpm) document.getElementById("songBpm").value = meta.bpm;
            if (meta.capo) document.getElementById("songCapo").value = meta.capo;
            loadCustomChordsFromText(initialContent);
        }


        // 清理網址，避免重整時再次從 URL 載入
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);


        // 生成段落按鈕
        const sectionGrid = document.getElementById("sectionGrid");
        SECTION_TYPES.forEach((section) => {
          const btn = document.createElement("button");
          btn.className = `section-btn ${section.class}`;
          btn.textContent = section.name;
          btn.onclick = () => insertSection(section.key);
          sectionGrid.appendChild(btn);
        });

        // 生成和弦按鈕
        const chordGrid = document.getElementById("chordGrid");
        COMMON_CHORDS.forEach((chord) => {
          const btn = document.createElement("button");
          btn.className = "chord-btn";
          btn.textContent = chord;
          btn.onclick = () => insertChord(chord);
          chordGrid.appendChild(btn);
        });

        saveToHistory();

        // --- 事件綁定 ---
        document.getElementById("homeBtn").onclick = () => {
          window.location.href = "library.html";
        };

        document.getElementById("playBtn").onclick = () => {
          // 前往閱讀器前，確保最新的內容已存入暫存區
          const currentContent = document.getElementById("editorTextarea").value;
          sessionStorage.setItem("currentSheetContent", currentContent);
          window.location.href = "reader.html";
        };

        document.getElementById("newBtn").onclick = newDocument;
        document.getElementById("exportBtn").onclick = exportDocument;
        document.getElementById("importBtn").onclick = () =>
          document.getElementById("importFile").click();
        document.getElementById("undoBtn").onclick = undo;
        document.getElementById("redoBtn").onclick = redo;
        document.getElementById("clearBtn").onclick = async () => {
          if (await showConfirm("確定要清空所有內容嗎？")) {
            saveToHistory();
            document.getElementById("editorTextarea").value = "";
            sessionStorage.setItem("currentSheetContent", ""); // 同步清空暫存
          }
        };
        document.getElementById("updateMetaBtn").onclick = updateMetaInfo;

        // 自定義和弦功能
        document.getElementById("addCustomChordBtn").onclick = addCustomChord;

        // 載入已保存的自定義和弦
        loadCustomChords();

        // 儲存按鈕事件
        document.getElementById("saveBtn").onclick = saveToSheetsFolder;

        document
          .getElementById("importFile")
          .addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
              importDocument(evt.target.result);
            };
            reader.readAsText(file, "utf-8");
          });
        
        // 自動儲存到 sessionStorage
        let saveTimeout;
        document.getElementById("editorTextarea").addEventListener("input", () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const content = document.getElementById("editorTextarea").value;
                sessionStorage.setItem("currentSheetContent", content);
            }, 300);
        });


        // 鍵盤快捷鍵
        document.addEventListener("keydown", (e) => {
          if (e.ctrlKey || e.metaKey) {
            if (e.key === "z" && !e.shiftKey) {
              e.preventDefault();
              undo();
            } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
              e.preventDefault();
              redo();
            } else if (e.key === "s") {
              e.preventDefault();
              exportDocument();
            } else if (e.key === "n") {
              e.preventDefault();
              newDocument();
            }
          }
        });
      }

      window.onload = init;

      // 模態視窗功能
      async function showConfirm(message, title = "請確認") {
        return new Promise((resolve) => {
          document.getElementById("modalTitle").textContent = title;
          document.getElementById("modalMessage").textContent = message;
          document.getElementById("modalConfirmBtn").classList.remove("hidden");
          document.getElementById("modalCancelBtn").classList.remove("hidden");
          document.getElementById("modalAlertOkBtn").classList.add("hidden");
          document.getElementById("customModal").classList.remove("hidden");

          document.getElementById("modalConfirmBtn").onclick = () => {
            document.getElementById("customModal").classList.add("hidden");

            resolve(true);
          };
          document.getElementById("modalCancelBtn").onclick = () => {
            document.getElementById("customModal").classList.add("hidden");
            resolve(false);
          };
        });
      }

      async function showAlert(message, title = "提示") {
        return new Promise((resolve) => {
          document.getElementById("modalTitle").textContent = title;
          document.getElementById("modalMessage").textContent = message;
          document.getElementById("modalConfirmBtn").classList.add("hidden");
          document.getElementById("modalCancelBtn").classList.add("hidden");
          document.getElementById("modalAlertOkBtn").classList.remove("hidden");
          document.getElementById("customModal").classList.remove("hidden");

          document.getElementById("modalAlertOkBtn").onclick = () => {
            document.getElementById("customModal").classList.add("hidden");
            resolve();
          };
        });
      }