import { playing, countingDown, rafId, lastTs, accumulatedScroll, countdownTimeoutId, setPlaying, setCountingDown, setRafId, setLastTs, setAccumulatedScroll, setTargets, setCountdownTimeoutId } from './state.js';

/** @type {ReturnType<typeof import('./metronome.js').initMetronome> | null} */
let metronomeRef = null;

export function initPlayback(metronome) {
  metronomeRef = metronome;
}

export function collectTargets() {
  const scoreEl = document.getElementById("score");
  const scoreTop = scoreEl.getBoundingClientRect().top;
  const newTargets = [...scoreEl.querySelectorAll(".line[data-section]")].map((el) => {
    const rect = el.getBoundingClientRect();
    return { el, top: rect.top - scoreTop + window.scrollY };
  });
  setTargets(newTargets);
}

function setPlayBtnState(playing) {
  const playBtn = document.getElementById("playBtn");
  if (!playBtn) return;
  playBtn.classList.toggle("is-playing", playing);
  playBtn.classList.toggle("primary", !playing);
  const label = playing ? "停止播放" : "開始播放";
  playBtn.title = label;
  playBtn.setAttribute("aria-label", label);
}

function resetPlayBtn() {
  const playBtn = document.getElementById("playBtn");
  if (!playBtn) return;
  playBtn.disabled = false;
  setPlayBtnState(false);
}

function cancelCountdown() {
  setCountingDown(false);
  metronomeRef?.clearBeatListener();
  clearTimeout(countdownTimeoutId);
  setCountdownTimeoutId(null);
  document.getElementById("countdownDisplay").classList.add("hidden");
}

function stopPlayback() {
  if (countingDown) cancelCountdown();
  if (playing) {
    setPlaying(false);
    cancelAnimationFrame(rafId);
    setAccumulatedScroll(0);
  }
  clearTimeout(countdownTimeoutId);
  setCountdownTimeoutId(null);
  metronomeRef?.endSession();
  resetPlayBtn();
}

function startScroll() {
  setPlaying(true);
  collectTargets();
  setLastTs(null);
  const newRafId = requestAnimationFrame(loop);
  setRafId(newRafId);
  setPlayBtnState(true);
}

function finishCountdown() {
  metronomeRef?.clearBeatListener();
  setCountingDown(false);
  document.getElementById("countdownDisplay").classList.add("hidden");
  startScroll();
}

function startCountdown() {
  const countdownDisplay = document.getElementById("countdownDisplay");

  setCountingDown(true);
  setPlayBtnState(true);
  countdownDisplay.classList.remove("hidden");

  metronomeRef?.beginSession();

  let countdownFinished = false;
  metronomeRef?.setBeatListener((beatIndex) => {
    if (countdownFinished) return;
    const display = 4 - beatIndex;
    if (display >= 1 && display <= 4) {
      countdownDisplay.textContent = String(display);
    }
    if (beatIndex >= 4) {
      countdownFinished = true;
      finishCountdown();
    }
  });
}

function startPlaybackSession() {
  const countdownEnabledCheckbox = document.getElementById("countdownEnabled");
  if (countdownEnabledCheckbox.checked) {
    startCountdown();
    return;
  }
  metronomeRef?.beginSession();
  startScroll();
}

export function togglePlay() {
  if (playing || countingDown) {
    stopPlayback();
    return;
  }
  startPlaybackSession();
}

function loop(ts) {
  if (!playing) return;
  if (!lastTs) setLastTs(ts);
  const dt = ts - lastTs;
  setLastTs(ts);

  const speed = +document.getElementById("speed").value;
  const scrollDist = (speed * dt) / 1000;
  setAccumulatedScroll(accumulatedScroll + scrollDist);

  if (accumulatedScroll >= 1) {
    const pixelsToScroll = Math.floor(accumulatedScroll);
    window.scrollBy({ top: pixelsToScroll, behavior: "auto" });
    setAccumulatedScroll(accumulatedScroll - pixelsToScroll);
  }

  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  const currentScrollY = window.scrollY;
  const scrollThreshold = 20;

  if (currentScrollY + clientHeight >= scrollHeight - scrollThreshold) {
    togglePlay();
    window.scrollTo({ top: scrollHeight, behavior: "smooth" });
    return;
  }

  const newRafId = requestAnimationFrame(loop);
  setRafId(newRafId);
}
