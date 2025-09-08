import { showAlert, showConfirm } from '../utils/ui-utils.js';
import { insertChord } from './textarea.js';

let customChords = {};

// --- 新增自定義和弦 ---
export function addCustomChord() {
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

  const fingering = [fret6, fret5, fret4, fret3, fret2, fret1];
  const isAllNegativeOne = fingering.every((f) => f === -1);
  const isAllInRange = fingering.every((f) => f >= -1 && f <= 24);

  if (!isAllInRange || isAllNegativeOne) {
    showAlert("指法無效");
    return;
  }

  customChords[chordName] = fingering;
  sessionStorage.setItem("customChords", JSON.stringify(customChords));

  // --- 添加到樂譜中 ---
  const textarea = document.getElementById("editorTextarea");
  const currentContent = textarea.value;
  const customChordLine = `@${chordName}: ${fingering.join(",")}`;
  const lines = currentContent.split("\n");  // 檢查是否已經存在該和弦定義
  const existingIndex = lines.findIndex((line) =>
    line.trim().startsWith(`@${chordName}:`)
  );

  if (existingIndex >= 0) {
    lines[existingIndex] = customChordLine;
  } else {
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() && !lines[i].trim().startsWith("#")) {
        insertIndex = i;// 找到第一個非 meta 行，在其前面插入
        break;
      }
    }
    lines.splice(insertIndex, 0, customChordLine);
  }

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

// --- 移除自定義和弦 ---
export async function deleteCustomChord(chordName) {
  if (await showConfirm(`確定要刪除 ${chordName} 和弦嗎？`)) {
    delete customChords[chordName];
    sessionStorage.setItem("customChords", JSON.stringify(customChords));


    const textarea = document.getElementById("editorTextarea");
    const currentContent = textarea.value;
    const lines = currentContent.split("\n");
    const filteredLines = lines.filter(
      (line) => !line.trim().startsWith(`@${chordName}:`)
    );

    textarea.value = filteredLines.join("\n");

    renderCustomChords();
  }
}

// --- 自定義和弦面板 ---
export function renderCustomChords() {
  const customChordGrid = document.getElementById("customChordGrid");
  customChordGrid.innerHTML = "";

  Object.keys(customChords).forEach((chordName) => {
    const btn = document.createElement("button");
    btn.className = "custom-chord-btn";
    btn.textContent = chordName;

    // 刪除按鈕
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      await deleteCustomChord(chordName);
    };
    btn.appendChild(deleteBtn);

    // 和弦按鈕
    btn.onclick = () => insertChord(chordName);
    customChordGrid.appendChild(btn);
  });
}

// --- 載入自定義和弦 ---
export function loadCustomChords() {
  const saved = sessionStorage.getItem("customChords");
  if (saved) {
    try {
      customChords = JSON.parse(saved);
      renderCustomChords();
    } catch (e) {
      console.log("自定義和弦載入失敗");
    }
  }
}

// --- 從樂譜解析自定義和弦 ---
export function loadCustomChordsFromText(text) {
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

  
  customChords = { ...customChords, ...newCustomChords };// 寫入新和弦
  sessionStorage.setItem("customChords", JSON.stringify(customChords)); // 儲存到 sessionStorage
  renderCustomChords(); // 重新渲染按鈕
}
