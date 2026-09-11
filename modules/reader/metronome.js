/**

 * 節拍器：Web Audio 排程 click 音，BPM 可調，強拍每 4 拍。

 * 僅在播放／預備拍 session 期間且使用者已啟用時才發聲。

 */



const BPM_MIN = 40;

const BPM_MAX = 240;

const LOOKAHEAD_MS = 25;

const SCHEDULE_AHEAD_SEC = 0.1;



function clampBpm(bpm) {

  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));

}



function defaultBpmFromSheet(getSheetBpm) {

  const raw = getSheetBpm();

  const n = Number(raw);

  return Number.isFinite(n) && n > 0 ? n : 120;

}



/**

 * @param {object} opts

 * @param {HTMLElement} opts.bpmMinusBtn

 * @param {HTMLElement} opts.bpmPlusBtn

 * @param {HTMLElement} opts.bpmDisplayEl

 * @param {HTMLElement} opts.resetBtn

 * @param {HTMLElement} opts.toggleBtn

 * @param {() => number|string|undefined|null} opts.getSheetBpm
 * @param {(bpm: number) => void} [opts.onBpmChange]

 */

export function initMetronome(opts) {

  const { bpmMinusBtn, bpmPlusBtn, bpmDisplayEl, resetBtn, toggleBtn, extraToggleBtns = [], getSheetBpm, onBpmChange } = opts;

  const toggleBtns = [toggleBtn, ...extraToggleBtns].filter(Boolean);



  let audioCtx = null;

  let userEnabled = false;

  let sessionActive = false;

  let schedulerRunning = false;

  let currentBpm = defaultBpmFromSheet(getSheetBpm);

  let beatIndex = 0;

  let nextBeatTime = 0;

  let schedulerTimer = null;

  /** @type {((beatIndex: number, isAccent: boolean) => void) | null} */

  let beatListener = null;



  function ensureCtx() {

    if (!audioCtx) {

      const Ctx = window.AudioContext || window.webkitAudioContext;

      if (!Ctx) return null;

      audioCtx = new Ctx();

    }

    if (audioCtx.state === "suspended") {

      audioCtx.resume().catch(() => {});

    }

    return audioCtx;

  }



  function isAudible() {

    return userEnabled && sessionActive;

  }



  function syncToggleBtn() {

    toggleBtns.forEach((btn) => {

      btn.classList.toggle("active", userEnabled);

      btn.setAttribute("aria-pressed", userEnabled ? "true" : "false");

      btn.title = userEnabled ? "關閉節拍器" : "節拍器";

    });

  }



  function updateDisplay() {

    if (bpmDisplayEl) bpmDisplayEl.value = String(currentBpm);

  }



  function setBpm(bpm, { restartIfRunning = false, emit = true } = {}) {

    currentBpm = clampBpm(bpm);

    updateDisplay();

    if (restartIfRunning && schedulerRunning) {

      restartScheduler();

    }

    if (emit) onBpmChange?.(currentBpm);

  }



  function playClick(time, isAccent) {

    const ctx = ensureCtx();

    if (!ctx || !isAudible()) return;

    const osc = ctx.createOscillator();

    const gain = ctx.createGain();

    osc.type = "sine";

    osc.connect(gain);

    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(isAccent ? 1000 : 760, time);

    const peak = isAccent ? 0.38 : 0.24;

    gain.gain.setValueAtTime(peak, time);

    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    osc.start(time);

    osc.stop(time + 0.05);

  }



  function schedulerTick() {

    const ctx = ensureCtx();

    if (!ctx || !schedulerRunning) return;

    while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {

      const currentBeat = beatIndex;

      const isAccent = currentBeat % 4 === 0;

      playClick(nextBeatTime, isAccent);

      beatListener?.(currentBeat, isAccent);

      nextBeatTime += 60 / currentBpm;

      beatIndex += 1;

    }

  }



  function startScheduler() {

    if (schedulerRunning) return;

    const ctx = ensureCtx();

    if (!ctx) return;

    schedulerRunning = true;

    beatIndex = 0;

    nextBeatTime = ctx.currentTime + 0.05;

    schedulerTimer = setInterval(schedulerTick, LOOKAHEAD_MS);

  }



  function stopScheduler() {

    if (!schedulerRunning) return;

    schedulerRunning = false;

    if (schedulerTimer != null) {

      clearInterval(schedulerTimer);

      schedulerTimer = null;

    }

  }



  function restartScheduler() {

    stopScheduler();

    startScheduler();

  }



  function beginSession() {

    sessionActive = true;

    restartScheduler();

  }



  function endSession() {

    sessionActive = false;

    stopScheduler();

    beatListener = null;

  }



  function toggleUserEnabled() {

    userEnabled = !userEnabled;

    syncToggleBtn();

    if (userEnabled && sessionActive && !schedulerRunning) {

      restartScheduler();

    }

  }



  function setBeatListener(listener) {

    beatListener = listener;

  }



  function clearBeatListener() {

    beatListener = null;

  }



  function onSheetLoaded() {

    endSession();

    userEnabled = false;

    syncToggleBtn();

    setBpm(defaultBpmFromSheet(getSheetBpm), { emit: false });

  }



  function setUserEnabled(enabled) {
    userEnabled = !!enabled;
    syncToggleBtn();
    if (userEnabled && sessionActive && !schedulerRunning) {
      restartScheduler();
    }
  }



  if (bpmMinusBtn) {

    bpmMinusBtn.addEventListener("click", (e) => {

      e.stopPropagation();

      setBpm(currentBpm - 1, { restartIfRunning: true });

    });

  }

  if (bpmPlusBtn) {

    bpmPlusBtn.addEventListener("click", (e) => {

      e.stopPropagation();

      setBpm(currentBpm + 1, { restartIfRunning: true });

    });

  }

  if (resetBtn) {

    resetBtn.addEventListener("click", (e) => {

      e.stopPropagation();

      setBpm(defaultBpmFromSheet(getSheetBpm), { restartIfRunning: true });

    });

  }

  if (toggleBtn) {

    toggleBtns.forEach((btn) => {

      btn.addEventListener("click", (e) => {

        e.stopPropagation();

        toggleUserEnabled();

      });

    });

  }

  if (bpmDisplayEl && bpmDisplayEl.tagName === "INPUT") {

    const commitInput = () => {

      setBpm(Number(bpmDisplayEl.value) || currentBpm, { restartIfRunning: true });

    };

    bpmDisplayEl.addEventListener("change", commitInput);

    bpmDisplayEl.addEventListener("keydown", (e) => {

      if (e.key === "Enter") {

        e.preventDefault();

        bpmDisplayEl.blur();

      }

    });

  }



  syncToggleBtn();

  updateDisplay();



  return {

    beginSession,

    endSession,

    restart: restartScheduler,

    setBeatListener,

    clearBeatListener,

    onSheetLoaded,

    isEnabled: () => userEnabled,

    setUserEnabled,

    isRunning: () => schedulerRunning,

    getBpm: () => currentBpm,

    setBpm,

    destroy: () => {

      endSession();

      if (audioCtx) {

        audioCtx.close().catch(() => {});

        audioCtx = null;

      }

    },

  };

}


