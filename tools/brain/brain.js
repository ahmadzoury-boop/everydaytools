// ================================
// Daily Brain — EverydayTools.uk
// Quiz mode: 5 questions per level
// With unlock logic (Easy → Medium → Hard)
// ================================

// ---- Config ----
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";
const THEME_KEY = "et_brain_theme_v1";
const PROGRESS_KEY = "et_brain_progress_v1";

// ---- State ----
let setsData = null;
let currentDiff = "easy";
let currentList = [];
let currentIndex = 0;
let score = 0;
let progress = {}; // { "2026-01-17": { easy: true, medium: true, hard: true } }

// ---- Helpers ----
const todayKey = () => new Date().toISOString().slice(0, 10);

const msToNextUtcMidnight = () => {
  const d = new Date();
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) -
    Date.now()
  );
};

const fmtHMS = (ms) => {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const normalize = (str) => String(str).trim().toLowerCase();

// ---- DOM refs ----
const elResetTime = document.getElementById("resetTime");
const elQuestion = document.getElementById("questionText");
const elAnswer = document.getElementById("answerInput");
const elSubmit = document.getElementById("submitBtn");
const elHintBtn = document.getElementById("hintBtn");
const elHintText = document.getElementById("hintText");
const elMessage = document.getElementById("message");

const btnEasy = document.getElementById("btnEasy");
const btnMedium = document.getElementById("btnMedium");
const btnHard = document.getElementById("btnHard");

const themeBlue = document.getElementById("themeBlue");
const themeOrange = document.getElementById("themeOrange");
const themeGold = document.getElementById("themeGold");

// ---- Storage for theme & progress ----
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

// ---- Theme ----
function applyTheme(name) {
  let accent = "#4ea1ff";
  if (name === "orange") accent = "#ff8c32";
  if (name === "gold") accent = "#f4c542";

  document.documentElement.style.setProperty("--accent", accent);

  [themeBlue, themeOrange, themeGold].forEach((b) =>
    b.classList.remove("active")
  );

  if (name === "orange") themeOrange.classList.add("active");
  else if (name === "gold") themeGold.classList.add("active");
  else themeBlue.classList.add("active");

  localStorage.setItem(THEME_KEY, name);
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "blue");
}

// ---- Unlock / lock helpers ----
function todayProgress() {
  const key = todayKey();
  if (!progress[key]) progress[key] = {};
  return progress[key];
}

function canPlayDifficulty(diff) {
  const p = todayProgress();
  if (diff === "easy") return true;
  if (diff === "medium") return !!p.easy;
  if (diff === "hard") return !!p.medium;
  return false;
}

function styleDifficultyButton(btn, unlocked) {
  btn.disabled = !unlocked;
  btn.style.opacity = unlocked ? "1" : "0.4";
  btn.style.cursor = unlocked ? "pointer" : "not-allowed";
}

function applyLocks() {
  const p = todayProgress();
  // Easy always unlocked
  styleDifficultyButton(btnEasy, true);
  styleDifficultyButton(btnMedium, !!p.easy);
  styleDifficultyButton(btnHard, !!p.medium);
}

function markCompleted(diff) {
  const p = todayProgress();
  if (diff === "easy") p.easy = true;
  if (diff === "medium") p.medium = true;
  if (diff === "hard") p.hard = true;
  saveProgress();
  applyLocks();
}

// ---- Load daily questions ----
function loadTodayQuestions(diff) {
  const day = todayKey();
  const daySet = setsData?.[day];
  if (!daySet || !Array.isArray(daySet[diff])) return [];

  // First 5 questions of that level for the day
  return daySet[diff].slice(0, 5);
}

// ---- Render question ----
function renderQuestion() {
  const item = currentList[currentIndex];
  if (!item) return;

  elQuestion.textContent = `(${currentIndex + 1}/${currentList.length}) ${
    item.q || ""
  }`;

  elAnswer.value = "";
  elMessage.textContent = "";
  elMessage.style.color = "#ffffff";

  if (item.hint) {
    elHintBtn.style.display = "inline-flex";
    elHintText.textContent = item.hint;
    elHintText.style.display = "none";
  } else {
    elHintBtn.style.display = "none";
    elHintText.textContent = "";
    elHintText.style.display = "none";
  }

  elSubmit.dataset.answer = item.a || "";
}

// ---- Difficulty switch ----
function setDifficulty(diff) {
  if (!canPlayDifficulty(diff)) {
    if (diff === "medium") {
      elMessage.textContent = "Finish Easy to unlock Medium.";
    } else if (diff === "hard") {
      elMessage.textContent = "Finish Medium to unlock Hard.";
    } else {
      elMessage.textContent = "";
    }
    elMessage.style.color = "#ffcc00";
    return;
  }

  currentDiff = diff;
  currentList = loadTodayQuestions(diff);
  currentIndex = 0;
  score = 0;

  [btnEasy, btnMedium, btnHard].forEach((b) =>
    b.classList.remove("active")
  );
  if (diff === "easy") btnEasy.classList.add("active");
  if (diff === "medium") btnMedium.classList.add("active");
  if (diff === "hard") btnHard.classList.add("active");

  if (currentList.length === 0) {
    elQuestion.textContent = "No puzzles for today.";
    elHintBtn.style.display = "none";
    elHintText.style.display = "none";
    return;
  }

  renderQuestion();
}

// ---- Check answer ----
function checkAnswer() {
  if (!currentList.length) return;

  const expected = elSubmit.dataset.answer;
  const user = normalize(elAnswer.value);

  if (!user) {
    elMessage.textContent = "Type your answer first.";
    elMessage.style.color = "#ffcc00";
    return;
  }

  if (normalize(expected) === user) {
    score++;
    elMessage.textContent = "Correct!";
    elMessage.style.color = "#4caf50";
  } else {
    elMessage.textContent = `Wrong. Correct answer: ${expected}`;
    elMessage.style.color = "#ff6b6b";
  }

  currentIndex++;

  if (currentIndex >= currentList.length) {
    // Finished this level
    markCompleted(currentDiff);
    elQuestion.textContent = `Finished ${currentDiff.toUpperCase()}! Score: ${score}/${currentList.length}`;

    elHintBtn.style.display = "none";
    elHintText.style.display = "none";

    // Optional: auto-suggest next level
    const p = todayProgress();
    if (currentDiff === "easy" && p.easy && !p.medium) {
      elMessage.textContent += " — Medium is now unlocked!";
      elMessage.style.color = "#4caf50";
    } else if (currentDiff === "medium" && p.medium && !p.hard) {
      elMessage.textContent += " — Hard is now unlocked!";
      elMessage.style.color = "#4caf50";
    }

    return;
  }

  setTimeout(renderQuestion, 700);
}

// ---- Hint ----
function toggleHint() {
  if (!elHintText.textContent) return;
  elHintText.style.display =
    elHintText.style.display === "block" ? "none" : "block";
}

// ---- Timer ----
function startCountdown() {
  function tick() {
    const ms = msToNextUtcMidnight();
    if (ms <= 0) {
      location.reload();
      return;
    }
    elResetTime.textContent = fmtHMS(ms);
  }
  tick();
  setInterval(tick, 1000);
}

// ---- Init ----
async function initBrain() {
  initTheme();
  startCountdown();

  progress = loadProgress();
  applyLocks();

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    setsData = await res.json();
  } catch (e) {
    console.error(e);
    elQuestion.textContent = "Failed to load puzzles.";
    return;
  }

  // Start at Easy (always unlocked)
  setDifficulty("easy");
}

// ---- Events ----
btnEasy.onclick = () => setDifficulty("easy");
btnMedium.onclick = () => setDifficulty("medium");
btnHard.onclick = () => setDifficulty("hard");

elSubmit.onclick = checkAnswer;
elAnswer.onkeydown = (e) => e.key === "Enter" && checkAnswer();
elHintBtn.onclick = toggleHint;

themeBlue.onclick = () => applyTheme("blue");
themeOrange.onclick = () => applyTheme("orange");
themeGold.onclick = () => applyTheme("gold");

// ---- Go ----
initBrain();
