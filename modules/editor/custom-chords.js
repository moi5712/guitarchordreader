import { showAlert, showConfirm } from '../utils/ui-utils.js';
import { insertChord } from './textarea.js';

let customChords = {};

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

export async function deleteCustomChord(chordName) {
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

    textarea.value = filteredLines.join("\n");

    renderCustomChords();
  }
}

export function renderCustomChords() {
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

export function loadCustomChords() {
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

  // 合併新的自定義和弦
  customChords = { ...customChords, ...newCustomChords };
  localStorage.setItem("customChords", JSON.stringify(customChords));
  renderCustomChords();
}
