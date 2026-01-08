let workMinutes = 25;
let breakMinutes = 5;
let longBreakEvery = 4;

let cycleCount = 0;
let isRunning = false;
let isWorkPhase = true;
let timerInterval = null;
let remainingSeconds = workMinutes * 60;
let soundEnabled = true;

const workValue = document.getElementById("workValue");
const breakValue = document.getElementById("breakValue");
const longEveryValue = document.getElementById("longEveryValue");
const timerDisplay = document.getElementById("timerDisplay");
const phaseLabel = document.getElementById("phaseLabel");
const progressFill = document.getElementById("progressFill");
const cycleCountEl = document.getElementById("cycleCount");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const soundToggle = document.getElementById("soundToggle");
const themeToggle = document.getElementById("themeToggle");
const timerCard = document.getElementById("timerCard");

function updateDisplay() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateProgress() {
  const total = isWorkPhase ? workMinutes * 60 : breakMinutes * 60;
  const percent = ((total - remainingSeconds) / total) * 100;
  progressFill.style.width = `${percent}%`;
}

function playSound() {
  if (!soundEnabled) return;
  const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
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
    updateDisplay();
    updateProgress();

    if (remainingSeconds <= 0) {
      playSound();
      switchPhase();
    }
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

startPauseBtn.addEventListener("click", () => {
  isRunning ? pauseTimer() : startTimer();
});

resetBtn.addEventListener("click", resetTimer);

document.getElementById("workMinus").onclick = () => {
  if (workMinutes > 1) workMinutes--;
  workValue.textContent = workMinutes;
  if (isWorkPhase) resetTimer();
};

document.getElementById("workPlus").onclick = () => {
  workMinutes++;
  workValue.textContent = workMinutes;
  if (isWorkPhase) resetTimer();
};

document.getElementById("breakMinus").onclick = () => {
  if (breakMinutes > 1) breakMinutes--;
  breakValue.textContent = breakMinutes;
  if (!isWorkPhase) resetTimer();
};

document.getElementById("breakPlus").onclick = () => {
  breakMinutes++;
  breakValue.textContent = breakMinutes;
  if (!isWorkPhase) resetTimer();
};

document.getElementById("longEveryMinus").onclick = () => {
  if (longBreakEvery > 1) longBreakEvery--;
  longEveryValue.textContent = longBreakEvery;
};

document.getElementById("longEveryPlus").onclick = () => {
  longBreakEvery++;
  longEveryValue.textContent = longBreakEvery;
};

soundToggle.onclick = () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = `Sound: ${soundEnabled ? "ON" : "OFF"}`;
};

themeToggle.onclick = () => {
  document.body.classList.toggle("light");
  themeToggle.textContent = document.body.classList.contains("light")
    ? "Light mode"
    : "Dark mode";
};

updateDisplay();
updateProgress();
