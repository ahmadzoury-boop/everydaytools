// -----------------------------
// Break Timer – advanced version
// -----------------------------

let workMin = 25;
let breakMin = 5;
let longEvery = 4;      // long break every X cycles
let soundOn = true;

// DOM elements
const timerDisplay = document.getElementById("timerDisplay");
const phaseLabel = document.getElementById("phaseLabel");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const cycleCountEl = document.getElementById("cycleCount");
const progressFill = document.getElementById("progressFill");
const timerCard = document.getElementById("timerCard");

const workValue = document.getElementById("workValue");
const breakValue = document.getElementById("breakValue");
const longEveryValue = document.getElementById("longEveryValue");

const workMinus = document.getElementById("workMinus");
const workPlus = document.getElementById("workPlus");
const breakMinus = document.getElementById("breakMinus");
const breakPlus = document.getElementById("breakPlus");
const longEveryMinus = document.getElementById("longEveryMinus");
const longEveryPlus = document.getElementById("longEveryPlus");

const themeToggle = document.getElementById("themeToggle");
const soundToggle = document.getElementById("soundToggle");

// Timer state
let phase = "WORK"; // WORK | BREAK | LONG_BREAK
let remaining = workMin * 60;
let totalPhaseSeconds = workMin * 60;
let intervalId = null;
let running = false;
let cycles = 0;

// Simple beep using Web Audio API
function playBeep() {
  if (!soundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

// Format seconds as MM:SS
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Update UI
function updateUI() {
  timerDisplay.textContent = formatTime(remaining);

  if (phase === "WORK") {
    phaseLabel.textContent = "Work";
    phaseLabel.classList.add("work");
    phaseLabel.classList.remove("break");
  } else if (phase === "BREAK") {
    phaseLabel.textContent = "Break";
    phaseLabel.classList.add("break");
    phaseLabel.classList.remove("work");
  } else {
    phaseLabel.textContent = "Long break";
    phaseLabel.classList.add("break");
    phaseLabel.classList.remove("work");
  }

  cycleCountEl.textContent = cycles;
  workValue.textContent = workMin;
  breakValue.textContent = breakMin;
  longEveryValue.textContent = longEvery;

  const progress = Math.max(0, Math.min(1, 1 - remaining / totalPhaseSeconds));
  progressFill.style.width = `${progress * 100}%`;
}

// Switch phases
function switchPhase() {
  playBeep();

  if (phase === "WORK") {
    // Completed a work cycle
    cycles++;

    if (longEvery > 0 && cycles % longEvery === 0) {
      phase = "LONG_BREAK";
      totalPhaseSeconds = breakMin * 2 * 60;
      remaining = totalPhaseSeconds;
    } else {
      phase = "BREAK";
      totalPhaseSeconds = breakMin * 60;
      remaining = totalPhaseSeconds;
    }
  } else {
    // Any break → back to work
    phase = "WORK";
    totalPhaseSeconds = workMin * 60;
    remaining = totalPhaseSeconds;
  }

  updateUI();
}

// Timer tick
function tick() {
  if (remaining > 0) {
    remaining--;
    updateUI();
  } else {
    switchPhase();
  }
}

// Start / Pause
startPauseBtn.addEventListener("click", () => {
  if (!running) {
    intervalId = setInterval(tick, 1000);
    running = true;
    startPauseBtn.textContent = "Pause";
    timerCard.classList.add("running");
  } else {
    clearInterval(intervalId);
    running = false;
    startPauseBtn.textContent = "Start";
    timerCard.classList.remove("running");
  }
});

// Reset
resetBtn.addEventListener("click", () => {
  clearInterval(intervalId);
  running = false;
  startPauseBtn.textContent = "Start";
  timerCard.classList.remove("running");

  phase = "WORK";
  totalPhaseSeconds = workMin * 60;
  remaining = totalPhaseSeconds;
  cycles = 0;

  updateUI();
});

// Work time controls
workMinus.addEventListener("click", () => {
  if (workMin > 1) workMin--;
  if (!running && phase === "WORK") {
    totalPhaseSeconds = workMin * 60;
    remaining = totalPhaseSeconds;
  }
  updateUI();
});

workPlus.addEventListener("click", () => {
  workMin++;
  if (!running && phase === "WORK") {
    totalPhaseSeconds = workMin * 60;
    remaining = totalPhaseSeconds;
  }
  updateUI();
});

// Break time controls
breakMinus.addEventListener("click", () => {
  if (breakMin > 1) breakMin--;
  if (!running && (phase === "BREAK" || phase === "LONG_BREAK")) {
    totalPhaseSeconds = (phase === "LONG_BREAK" ? breakMin * 2 : breakMin) * 60;
    remaining = totalPhaseSeconds;
  }
  updateUI();
});

breakPlus.addEventListener("click", () => {
  breakMin++;
  if (!running && (phase === "BREAK" || phase === "LONG_BREAK")) {
    totalPhaseSeconds = (phase === "LONG_BREAK" ? breakMin * 2 : breakMin) * 60;
    remaining = totalPhaseSeconds;
  }
  updateUI();
});

// Long break every X cycles
longEveryMinus.addEventListener("click", () => {
  if (longEvery > 1) longEvery--;
  updateUI();
});

longEveryPlus.addEventListener("click", () => {
  longEvery++;
  updateUI();
});

// Theme toggle
themeToggle.addEventListener("click", () => {
  const body = document.body;
  const isLight = body.classList.toggle("light");
  themeToggle.textContent = isLight ? "Light mode" : "Dark mode";
});

// Sound toggle
soundToggle.addEventListener("click", () => {
  soundOn = !soundOn;
  soundToggle.textContent = soundOn ? "Sound: ON" : "Sound: OFF";
});

// Initialize
updateUI();
