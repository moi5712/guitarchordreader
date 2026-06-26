/**
 * 調音器模組：麥克風即時音高偵測、儀表板顯示。
 * 開啟面板時自動開始聆聽，關閉時停止。
 */

import { setDockPanelOpen } from "./dock-state.js";

/** 標準吉他六弦（用於「最接近」提示） */
const STANDARD_STRINGS = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110 },
  { name: 'D3', freq: 146.83 },
  { name: 'G3', freq: 196 },
  { name: 'B3', freq: 246.94 },
  { name: 'E4', freq: 329.63 },
];

/** 十二半音名稱（升記號） */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MIN_HZ = 65;
const MAX_HZ = 400;
const CENTS_RANGE = 50;
/** 低於此視為靜音，不顯示音高（避免無輸入時亂跳） */
const SILENCE_RMS_THRESHOLD = 0.008;
/** 顯示用平滑係數：愈小愈不跳動 */
const SMOOTHING = 0.12;
/** 頻率平滑：高音（B3/E4）週期短、取樣點少，單幀易飄，略做平滑 */
const FREQ_SMOOTHING = 0.25;

/** A4 = 440 Hz = MIDI 69；C4（中央 C）= MIDI 60，八度為 4 */
function hzToNoteWithCents(hz) {
  if (hz <= 0) return null;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const midiRound = Math.round(midi);
  const noteIndex = ((midiRound % 12) + 12) % 12;
  const octave = Math.floor(midiRound / 12) - 1;
  const centsFromNote = (midi - midiRound) * 100;
  return {
    noteName: NOTE_NAMES[noteIndex] + octave,
    centsFromNote,
  };
}

function freqToCents(freq, referenceHz) {
  if (freq <= 0 || referenceHz <= 0) return 0;
  return 1200 * Math.log2(freq / referenceHz);
}

function findClosestString(hz) {
  if (hz < MIN_HZ || hz > MAX_HZ) return null;
  let closest = STANDARD_STRINGS[0];
  let minDiff = Infinity;
  for (const s of STANDARD_STRINGS) {
    const diff = Math.abs(hz - s.freq);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  const cents = freqToCents(hz, closest.freq);
  return { note: closest.name, cents, referenceHz: closest.freq };
}

function getRMS(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    sum += x * x;
  }
  return Math.sqrt(sum / samples.length);
}

/** 對 buffer 套用 Hann 窗，減少頻譜洩漏、提升峰值清晰度 */
function applyHannWindow(samples) {
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    samples[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
}

/**
 * 計算自相關在給定 lag 的值（已套用 Hann 的 buffer）
 */
function correlationAt(samples, lag) {
  let sum = 0;
  const n = samples.length - lag;
  for (let i = 0; i < n; i++) {
    sum += samples[i] * samples[i + lag];
  }
  return sum / n;
}

/**
 * 拋物線插值：用 (lag-1, lag, lag+1) 三點找頂點，得到次取樣精度的 lag。
 * 高音（B3/E4）週期短，峰值較窄，插值易 overshoot，故限制 delta 在 ±0.5。
 */
function parabolicInterpolation(samples, bestLag) {
  const cPrev = bestLag > 1 ? correlationAt(samples, bestLag - 1) : 0;
  const cCur = correlationAt(samples, bestLag);
  const cNext = correlationAt(samples, bestLag + 1);
  const denom = cPrev - 2 * cCur + cNext;
  let delta = Number.isFinite(denom) && denom !== 0
    ? 0.5 * (cPrev - cNext) / denom
    : 0;
  delta = Math.max(-0.5, Math.min(0.5, delta));
  return bestLag + delta;
}

/**
 * 自相關法估計基頻 (Hz)，含 Hann 窗與拋物線插值。
 * 高音（B3/E4）較不準的原因：週期短（約 130–180 取樣），每週期取樣點少；
 * 自相關峰較窄，易受雜訊與窗函數影響；略做頻率平滑可穩定顯示。
 */
function detectPitch(samples, sampleRate) {
  const size = samples.length;
  const maxLag = Math.min(size >> 1, Math.floor(sampleRate / MIN_HZ));
  const minLag = Math.max(2, Math.ceil(sampleRate / MAX_HZ));

  const work = new Float32Array(size);
  work.set(samples);
  applyHannWindow(work);

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag < maxLag; lag++) {
    const corr = correlationAt(work, lag);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  /* 高音常鎖到「兩倍週期」（頻率顯示成一半）；若「一半 lag」相關性也夠強，改採較短週期 = 較高頻率 */
  const halfLag = Math.round(bestLag / 2);
  if (halfLag >= minLag) {
    const corrHalf = correlationAt(work, halfLag);
    if (corrHalf >= 0.88 * bestCorr) {
      bestLag = halfLag;
      bestCorr = corrHalf;
    }
  }

  const refinedLag = parabolicInterpolation(work, bestLag);
  const freq = sampleRate / refinedLag;

  return freq >= MIN_HZ && freq <= MAX_HZ ? freq : null;
}

function buildPanelContent() {
  return `
    <div class="tuner-note" data-tuner-note>—</div>
    <div class="tuner-hz" data-tuner-hz>— Hz</div>
    <div class="tuner-meter">
      <div class="tuner-meter-center"></div>
      <div class="tuner-meter-needle" data-tuner-needle></div>
    </div>
    <div class="tuner-cents" data-tuner-cents>0 cents</div>
  `;
}

let audioContext = null;
let stream = null;
let analyser = null;
let source = null;
let animationId = null;
let mediaStream = null;

const analyserFftSize = 4096;
const bufferLength = analyserFftSize;
const dataArray = new Float32Array(bufferLength);

/** 用於平滑顯示，避免指針劇烈跳動 */
let smoothedCents = 0;
/** 頻率平滑，利於 B3/E4 等高音穩定 */
let smoothedHz = 0;

function clampCents(c) {
  return Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, c));
}

function updateMeterNeedle(needleEl, cents) {
  const clamped = clampCents(cents);
  const percent = 50 + (clamped / CENTS_RANGE) * 50;
  needleEl.style.left = `${percent}%`;
}

function stopListening(panelEl) {
  if (animationId != null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (source && audioContext) {
    try {
      source.disconnect();
    } catch (_) {}
    source = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  mediaStream = null;
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
  }
  audioContext = null;
  analyser = null;

}

function updateLoop(panelEl) {
  if (!analyser || !panelEl.isConnected) return;

  analyser.getFloatTimeDomainData(dataArray);
  const rms = getRMS(dataArray);
  const isSilent = rms < SILENCE_RMS_THRESHOLD;

  const noteEl = panelEl.querySelector('[data-tuner-note]');
  const hzEl = panelEl.querySelector('[data-tuner-hz]');
  const centsEl = panelEl.querySelector('[data-tuner-cents]');
  const needleEl = panelEl.querySelector('[data-tuner-needle]');

  if (isSilent) {
    if (noteEl) noteEl.textContent = '—';
    if (hzEl) hzEl.textContent = '— Hz';
    if (centsEl) centsEl.textContent = '—';
    smoothedCents = smoothedCents * (1 - SMOOTHING);
    if (needleEl) updateMeterNeedle(needleEl, smoothedCents);
  } else {
    const sampleRate = audioContext?.sampleRate ?? 44100;
    const freq = detectPitch(dataArray, sampleRate);
    if (freq != null) {
      if (smoothedHz <= 0) smoothedHz = freq;
      else smoothedHz = smoothedHz * (1 - FREQ_SMOOTHING) + freq * FREQ_SMOOTHING;
      const noteResult = hzToNoteWithCents(smoothedHz);
      if (noteResult) {
        if (noteEl) noteEl.textContent = noteResult.noteName;
        if (hzEl) hzEl.textContent = `${smoothedHz.toFixed(1)} Hz`;
        smoothedCents = smoothedCents * (1 - SMOOTHING) + noteResult.centsFromNote * SMOOTHING;
        const c = Math.round(smoothedCents);
        if (centsEl) centsEl.textContent = `${c >= 0 ? '+' : ''}${c} cents`;
        if (needleEl) updateMeterNeedle(needleEl, smoothedCents);
      }
    } else {
      if (noteEl) noteEl.textContent = '—';
      if (hzEl) hzEl.textContent = smoothedHz > 0 ? `${smoothedHz.toFixed(1)} Hz` : '— Hz';
      smoothedCents = smoothedCents * (1 - SMOOTHING);
      if (centsEl) centsEl.textContent = `${Math.round(smoothedCents) >= 0 ? '+' : ''}${Math.round(smoothedCents)} cents`;
      if (needleEl) updateMeterNeedle(needleEl, smoothedCents);
    }
  }

  animationId = requestAnimationFrame(() => updateLoop(panelEl));
}

async function startListening(panelEl) {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    return;
  }

  stream = mediaStream;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = analyserFftSize;
  analyser.smoothingTimeConstant = 0.75;

  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  smoothedCents = 0;
  smoothedHz = 0;
  updateLoop(panelEl);
}


/**
 * @param {HTMLElement} buttonEl - 觸發按鈕
 * @param {HTMLElement} panelEl - 面板容器（內容由模組建立）
 * @param {{ onOpen?: () => void }} [options]
 * @returns {{ open: () => void, close: () => void, toggle: () => void, isOpen: () => boolean }}
 */
export function initTuner(buttonEl, panelEl, options = {}) {
  const { onOpen, extraTriggerBtns = [] } = options;
  const triggerBtns = [buttonEl, ...extraTriggerBtns].filter(Boolean);
  const bodyEl = panelEl.querySelector(".dock-panel-body") || panelEl;
  bodyEl.innerHTML = buildPanelContent();
  const unitEl = panelEl.closest(".dock-unit");
  let isOpen = false;

  function syncTriggerAria() {
    triggerBtns.forEach((btn) => {
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.classList.toggle("active", isOpen);
      if (isOpen) {
        btn.title = "收合調音器";
        btn.setAttribute("aria-label", "收合調音器");
      } else {
        btn.title = "調音器";
        btn.setAttribute("aria-label", "調音器");
      }
    });
  }

  function open() {
    if (isOpen) return;
    onOpen?.();
    isOpen = true;
    panelEl.classList.add('visible');
    panelEl.setAttribute('aria-hidden', 'false');
    unitEl?.classList.add('is-open');
    syncTriggerAria();
    setDockPanelOpen("tuner", true);
    startListening(panelEl);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    panelEl.classList.remove('visible');
    panelEl.setAttribute('aria-hidden', 'true');
    unitEl?.classList.remove('is-open');
    syncTriggerAria();
    setDockPanelOpen("tuner", false);
    stopListening(panelEl);
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  triggerBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });
  });

  panelEl.addEventListener('click', (e) => e.stopPropagation());

  syncTriggerAria();

  return {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
  };
}
