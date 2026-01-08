// --- CONFIGURABLE SETTINGS ---
let workMinutes = 25;
let breakMinutes = 5;
let longBreakEvery = 4;

// --- INTERNAL STATE ---
let cycleCount = 0;
let isRunning = false;
let isWorkPhase = true;
let timerInterval = null;
let remainingSeconds = workMinutes * 60;
let soundEnabled = localStorage.getItem("soundEnabled") !== "false"; // default ON

// --- ELEMENTS ---
const el = (id) => document.getElementById(id);
const workValue = el("workValue");
const breakValue = el("breakValue");
const longEveryValue = el("longEveryValue");
const timerDisplay = el("timerDisplay");
const phaseLabel = el("phaseLabel");
const progressFill = el("progressFill");
const cycleCountEl = el("cycleCount");
const startPauseBtn = el("startPauseBtn");
const resetBtn = el("resetBtn");
const soundToggle = el("soundToggle");
const themeToggle = el("themeToggle");
const timerCard = el("timerCard");

// --- FUNCTIONS ---
function updateDisplay() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  document.title = `⏱ ${timerDisplay.textContent} – Break Timer`;
}

function updateProgress() {
  const total = isWorkPhase ? workMinutes * 60 : breakMinutes * 60;
  const percent = ((total - remainingSeconds) / total) * 100;
  progressFill.style.width = `${Math.min(percent, 100)}%`;
}

function playSound() {
  if (!soundEnabled) return;
  const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  audio.volume = 0.5;
  audio.play();
}

function switchPhase() {
  isWorkPhase = !isWorkPhase;

  if (isWorkPhase) {
    phaseLabel.textContent = "Work";
    phaseLabel.className = "timer-phase work";
    remainingSeconds = workMinutes * 60;
  } else {
    cycleCount++;
    cycleCountEl.textContent = cycleCount;

    const isLongBreak = cycleCount % longBreakEvery === 0;
    remainingSeconds = isLongBreak ? breakMinutes * 120 : breakMinutes * 60;
    phaseLabel.textContent = isLongBreak ? "Long Break" : "Break";
    phaseLabel.className = "timer-phase break";
  }

  playSound();
  updateDisplay();
  updateProgress();
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  timerCard.classList.add("running");
  startPauseBtn.textContent = "Pause";

  timerInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds < 0) {
      switchPhase();
      return;
    }
    updateDisplay();
    updateProgress();
  }, 1000);
}

function pauseTimer() {
  isRunning = false;
  timerCard.classList.remove("running");
  startPauseBtn.textContent = "Start";
  clearInterval(timerInterval);
}

function resetTimer() {
  pauseTimer();
  isWorkPhase = true;
  remainingSeconds = workMinutes * 60;
  phaseLabel.textContent = "Work";
  phaseLabel.className = "timer-phase work";
  updateDisplay();
  updateProgress();
}

// --- EVENT LISTENERS ---
startPauseBtn.addEventListener("click", () => {
  isRunning ? pauseTimer() : startTimer();
});

resetBtn.addEventListener("click", resetTimer);

el("workMinus").onclick = () => {
  if (workMinutes > 1) workMinutes--;
  workValue.textContent = workMinutes;
  if (isWorkPhase) resetTimer();
};
el("workPlus").onclick = () => {
  workMinutes++;
  workValue.textContent = workMinutes;
  if (isWorkPhase) resetTimer();
};
el("breakMinus").onclick = () => {
  if (breakMinutes > 1) breakMinutes--;
  breakValue.textContent = breakMinutes;
  if (!isWorkPhase) resetTimer();
};
el("breakPlus").onclick = () => {
  breakMinutes++;
  breakValue.textContent = breakMinutes;
  if (!isWorkPhase) resetTimer();
};
el("longEveryMinus").onclick = () => {
  if (longBreakEvery > 1) longBreakEvery--;
  longEveryValue.textContent = longBreakEvery;
};
el("longEveryPlus").onclick = () => {
  longBreakEvery++;
  longEveryValue.textContent = longBreakEvery;
};

// --- SOUND & THEME TOGGLES ---
soundToggle.onclick = () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("soundEnabled", soundEnabled);
  soundToggle.textContent = `Sound: ${soundEnabled ? "ON" : "OFF"}`;
};

themeToggle.onclick = () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  themeToggle.textContent = isLight ? "Light mode" : "Dark mode";
};

// --- RESTORE SAVED THEME ---
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
  themeToggle.textContent = "Light mode";
}

// --- INITIALIZE ---
updateDisplay();
updateProgress();
soundToggle.textContent = `Sound: ${soundEnabled ? "ON" : "OFF"}`;
