import { playing, rafId, lastTs, accumulatedScroll, song, countdownTimeoutId, setPlaying, setRafId, setLastTs, setAccumulatedScroll, setTargets, setCountdownTimeoutId } from './state.js';

export function collectTargets() {
  const scoreEl = document.getElementById("score");
  const scoreTop = scoreEl.getBoundingClientRect().top;
  const newTargets = [...scoreEl.querySelectorAll(".line[data-section]")].map((el) => {
    const rect = el.getBoundingClientRect();
    return { el, top: rect.top - scoreTop + window.scrollY };
  });
  setTargets(newTargets);
}

function startScroll() {
  setPlaying(true);
  collectTargets();
  setLastTs(null);
  const newRafId = requestAnimationFrame(loop);
  setRafId(newRafId);
  const playBtn = document.getElementById("playBtn");
  playBtn.textContent = "⏹ 停止";
  playBtn.classList.remove("primary");
}

export function togglePlay() {
  const playBtn = document.getElementById("playBtn");
  if (playing) {
    setPlaying(false);
    cancelAnimationFrame(rafId);
    clearTimeout(countdownTimeoutId);
    const countdownDisplay = document.getElementById("countdownDisplay");
    countdownDisplay.style.display = "none";
    setAccumulatedScroll(0);
    playBtn.textContent = "▶︎ 開始";
    playBtn.classList.add("primary");
    playBtn.disabled = false;
  } else {
    const countdownEnabledCheckbox = document.getElementById("countdownEnabled");
    const isCountdownEnabled = countdownEnabledCheckbox.checked;
    const bpm = song.meta.bpm || 120;
    const beatDuration = 60000 / bpm;

    if (isCountdownEnabled) {
      let count = 4;
      playBtn.disabled = true;
      const countdownDisplay = document.getElementById("countdownDisplay");
      countdownDisplay.style.display = "block";

      function doCountdown() {
        if (count > 0) {
          countdownDisplay.textContent = count;
          count--;
          const newCountdownTimeoutId = setTimeout(doCountdown, beatDuration);
          setCountdownTimeoutId(newCountdownTimeoutId);
        } else {
          countdownDisplay.style.display = "none";
          playBtn.disabled = false;
          startScroll();
        }
      }
      doCountdown();
    } else {
      startScroll();
    }
  }
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
