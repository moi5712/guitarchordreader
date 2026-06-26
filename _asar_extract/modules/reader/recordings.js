import { setDockPanelOpen } from "./dock-state.js";
import { createRecordingPlayer } from "./recording-player.js";

const DB_NAME = "guitarSheetReaderMedia";
const STORE_NAME = "sheetRecordings";
const DB_VERSION = 1;

let dbPromise = null;

function buildPanelContent() {
  return `
    <div class="recordings-error hidden" data-rec-error role="alert"></div>
    <div class="recordings-recorder">
      <div class="recordings-timer" data-rec-timer>00:00</div>
      <div class="recordings-controls">
        <button type="button" class="control-rec-btn" data-rec-main title="開始錄音" aria-label="開始錄音">
          <span class="control-rec-dot" aria-hidden="true"></span>
        </button>
        <button type="button" class="btn btn-xs ghost hidden" data-rec-cancel>取消</button>
      </div>
    </div>
    <div class="recordings-list" data-rec-list></div>
  `;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("sheetKey", "sheetKey", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("無法開啟錄音資料庫"));
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("資料操作失敗"));
    tx.onabort = () => reject(tx.error || new Error("資料操作中止"));
  });
}

async function saveRecording(recording) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).add(recording);
  await txDone(tx);
}

async function listRecordings(sheetKey) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const idx = store.index("sheetKey");
  const req = idx.getAll(IDBKeyRange.only(sheetKey));
  const items = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error("讀取錄音失敗"));
  });
  await txDone(tx);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function removeRecording(id) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await txDone(tx);
}

async function patchRecordingDuration(id, durationMs) {
  if (!id || !durationMs || durationMs <= 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const record = await new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("讀取錄音失敗"));
  });
  if (!record || (record.durationMs && record.durationMs >= durationMs)) {
    await txDone(tx);
    return;
  }
  record.durationMs = durationMs;
  store.put(record);
  await txDone(tx);
}

function encodeWav(audioBuffer) {
  const sr = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const pcm = new Float32Array(len);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const chData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) pcm[i] += chData[i] / audioBuffer.numberOfChannels;
  }
  const ab = new ArrayBuffer(44 + len * 2);
  const v = new DataView(ab);
  const w = (off, str) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true);
  w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const x = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7FFF, true);
  }
  return new Blob([ab], { type: 'audio/wav' });
}

async function toSeekableBlob(rawBlob) {
  try {
    const ab = await rawBlob.arrayBuffer();
    const ctx = new AudioContext();
    let buf;
    try { buf = await ctx.decodeAudioData(ab); }
    finally { ctx.close(); }
    return encodeWav(buf);
  } catch {
    return rawBlob;
  }
}

function pickRecorderMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function fmtTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

const AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
  sampleRate: { ideal: 48000 },
};

export function initRecordings(buttonEl, panelEl, getSheetContext, options = {}) {
  const { onBeforeRecord, onOpen, extraTriggerBtns = [] } = options;
  const triggerBtns = [buttonEl, ...extraTriggerBtns].filter(Boolean);
  const bodyEl = panelEl.querySelector(".dock-panel-body") || panelEl;
  bodyEl.innerHTML = buildPanelContent();
  const unitEl = panelEl.closest(".dock-unit");
  const buttonPlaceholder = document.createComment("recordings-button-placeholder");
  const originalButtonParent = buttonEl?.parentNode || null;
  if (originalButtonParent && buttonEl) {
    originalButtonParent.insertBefore(buttonPlaceholder, buttonEl);
  }

  const timerEl = bodyEl.querySelector("[data-rec-timer]");
  const listEl = bodyEl.querySelector("[data-rec-list]");
  const recBtn = bodyEl.querySelector("[data-rec-main]");
  const cancelBtn = bodyEl.querySelector("[data-rec-cancel]");
  const errorEl = bodyEl.querySelector("[data-rec-error]");
  const recorderWrapEl = bodyEl.querySelector(".recordings-recorder");

  let isOpen = false;
  let isRecording = false;
  let recorder = null;
  let mediaStream = null;
  let chunks = [];
  let timerId = null;
  let startedAt = 0;
  let discardOnStop = false;
  let pendingDurationMs = 0;

  const player = createRecordingPlayer({
    listEl,
    canInteract: () => !isRecording,
    onDelete: async (id) => {
      await removeRecording(id);
      await renderList();
    },
    onPatchDuration: (id, ms) => patchRecordingDuration(id, ms).catch(() => {}),
  });

  const syncTriggerAria = () => {
    triggerBtns.forEach((btn) => {
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.classList.toggle("active", isOpen);
      btn.title = isOpen ? "收合錄音" : "錄音";
      btn.setAttribute("aria-label", isOpen ? "收合錄音" : "錄音");
    });
  };

  const setTimerText = (ms) => {
    if (timerEl) timerEl.textContent = fmtTime(ms);
  };

  const getElapsedMs = (now = Date.now()) => (isRecording ? Math.max(0, now - startedAt) : 0);

  const startTimer = () => {
    if (timerId != null) return;
    timerId = setInterval(() => setTimerText(getElapsedMs()), 250);
  };

  const stopTimer = () => {
    if (timerId == null) return;
    clearInterval(timerId);
    timerId = null;
  };

  const setRecordingUi = (active) => {
    triggerBtns.forEach((btn) => btn.classList.toggle("recordings-active", active));
    if (recBtn) {
      recBtn.classList.toggle("is-recording", active);
      recBtn.title = active ? "停止並儲存" : "開始錄音";
      recBtn.setAttribute("aria-label", active ? "停止並儲存" : "開始錄音");
    }
    if (cancelBtn) cancelBtn.classList.toggle("hidden", !active);
  };

  const showError = (message) => {
    if (!errorEl) return;
    errorEl.textContent = message || "";
    errorEl.classList.toggle("hidden", !message);
  };

  const stopStream = () => {
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    recorder = null;
  };

  const mountDesktopTriggerInRecorder = () => {
    if (!buttonEl || !recorderWrapEl) return;
    if (!buttonEl.classList.contains("desktop-only")) return;
    recorderWrapEl.appendChild(buttonEl);
  };

  const restoreDesktopTriggerPosition = () => {
    if (!buttonEl || !buttonPlaceholder?.parentNode) return;
    buttonPlaceholder.parentNode.insertBefore(buttonEl, buttonPlaceholder.nextSibling);
  };

  const renderList = async () => {
    const { key } = getSheetContext();
    if (!key) {
      player.render([]);
      return;
    }
    const items = await listRecordings(key);
    player.render(items);
  };

  const startRecording = async () => {
    if (!window.MediaRecorder) {
      showError("此環境不支援錄音");
      return;
    }
    showError("");
    try {
      if (onBeforeRecord) await onBeforeRecord();
      player.stopAll(); // 錄音開始時自動停止並重置播放進度
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      chunks = [];
      const mimeType = pickRecorderMimeType();
      const recorderOptions = { audioBitsPerSecond: 256000 };
      if (mimeType) recorderOptions.mimeType = mimeType;
      recorder = new MediaRecorder(mediaStream, recorderOptions);
      startedAt = Date.now();
      discardOnStop = false;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = () => {
        showError("錄音過程發生錯誤");
        stopRecording({ discard: true });
      };
      recorder.onstop = async () => {
        const durationMs = Math.max(pendingDurationMs || 0, getElapsedMs());
        pendingDurationMs = 0;
        const { key, label } = getSheetContext();
        const blobType = recorder?.mimeType || mimeType || "audio/webm";
        if (!discardOnStop && chunks.length && key) {
          const rawBlob = new Blob(chunks, { type: blobType });
          const finalBlob = await toSeekableBlob(rawBlob);
          await saveRecording({
            sheetKey: key,
            sheetLabel: label || "未命名樂譜",
            createdAt: Date.now(),
            durationMs,
            blob: finalBlob,
          });
        }
        isRecording = false;
        discardOnStop = false;
        stopTimer();
        setRecordingUi(false);
        setTimerText(0);
        stopStream();
        await renderList();
      };

      recorder.start();
      isRecording = true;
      startTimer();
      setRecordingUi(true);
      setTimerText(0);
    } catch (err) {
      stopStream();
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        showError("麥克風權限被拒絕，請在系統設定中允許存取");
      } else if (name === "NotFoundError") {
        showError("找不到可用的麥克風裝置");
      } else {
        showError("無法開始錄音，請確認麥克風可用");
      }
    }
  };

  const stopRecording = ({ discard = false } = {}) => {
    if (!isRecording || !recorder) return;
    pendingDurationMs = getElapsedMs();
    discardOnStop = discard;
    stopTimer();
    try {
      if (recorder.state !== "inactive") recorder.requestData();
    } catch (_) {}
    recorder.stop();
  };

  const open = async () => {
    if (isOpen) {
      await renderList();
      return;
    }
    onOpen?.();
    isOpen = true;
    panelEl.classList.add("visible");
    panelEl.setAttribute("aria-hidden", "false");
    unitEl?.classList.add("is-open");
    syncTriggerAria();
    setDockPanelOpen("recordings", true);
    setTimerText(getElapsedMs());
    mountDesktopTriggerInRecorder();
    await renderList();
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    panelEl.classList.remove("visible");
    panelEl.setAttribute("aria-hidden", "true");
    unitEl?.classList.remove("is-open");
    syncTriggerAria();
    setDockPanelOpen("recordings", false);
    restoreDesktopTriggerPosition();
    player.render([]);
  };

  const toggle = async () => {
    if (isOpen) close();
    else await open();
  };

  recBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!isRecording) await startRecording();
    else stopRecording({ discard: false });
  });
  cancelBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    stopRecording({ discard: true });
  });
  triggerBtns.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    })
  );
  panelEl.addEventListener("click", (e) => e.stopPropagation());

  setRecordingUi(false);
  setTimerText(0);
  syncTriggerAria();

  return {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    isRecording: () => isRecording,
    stopRecording: () => stopRecording({ discard: false }),
    destroy: () => {
      if (isRecording && recorder && recorder.state !== "inactive") {
        try {
          recorder.requestData();
        } catch (_) {}
        try {
          recorder.stop();
        } catch (_) {}
      } else {
        stopStream();
      }
      stopTimer();
      player.destroy();
      restoreDesktopTriggerPosition();
    },
  };
}

