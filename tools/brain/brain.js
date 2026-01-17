// ================================
// Daily Brain — EverydayTools.uk
// Final Production brain.js
// Supports array-based puzzles (q / a / hint / explanation)
// ================================

// ---- Config ----
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const THEME_KEY = "et_brain_theme_v1";

// ---- State ----
let setsData = null;
let currentDiff = "easy";
let currentTodayKey = null;

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

const normalize = (str) =>
  String(str).trim().toLowerCase();

// ---- Local storage ----
function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocal(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

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

// ---- Theme handling ----
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

// ---- Data helpers ----
function getTodaySet() {
  if (!setsData) return null;
  currentTodayKey = todayKey();
  return setsData[currentTodayKey] || null;
}

// ---- Question logic ----
function showQuestion() {
  const daySet = getTodaySet();
  elMessage.textContent = "";
  elHintText.style.display = "none";
  elHintText.textContent = "";
  elAnswer.value = "";

  if (!daySet || !daySet[currentDiff]) {
    elQuestion.textContent = "No puzzle available for today.";
    return;
  }

  const list = daySet[currentDiff];

  if (!Array.isArray(list) || list.length === 0) {
    elQuestion.textContent = "No puzzle available for today.";
    return;
  }

  // Deterministic daily index (same question all day)
  const index =
    Math.abs(
      [...currentTodayKey].reduce((a, c) => a + c.charCodeAt(0), 0)
    ) % list.length;

  const item = list[index];

  elQuestion.textContent = item.q || "Puzzle missing text.";

  if (item.hint) {
    elHintBtn.style.display = "inline-flex";
    elHintText.textContent = item.hint;
  } else {
    elHintBtn.style.display = "none";
  }

  // Store answer + explanation for later use
  elSubmit.dataset.answer = item.a || "";
  elSubmit.dataset.explanation = item.explanation || "";
}

// ---- Difficulty ----
function setDifficulty(diff) {
  currentDiff = diff;

  [btnEasy, btnMedium, btnHard].forEach((b) =>
    b.classList.remove("active")
  );

  if (diff === "easy") btnEasy.classList.add("active");
  if (diff === "medium") btnMedium.classList.add("active");
  if (diff === "hard") btnHard.classList.add("active");

  showQuestion();
}

// ---- Answer check ----
function checkAnswer() {
  const expected = elSubmit.dataset.answer;
  if (!expected) return;

  const user = normalize(elAnswer.value);
  if (!user) {
    elMessage.textContent = "Type your answer first.";
    elMessage.style.color = "#ffcc00";
    return;
  }

  const ok = normalize(expected) === user;

  if (ok) {
    elMessage.textContent = "Correct! 🎉";
    elMessage.style.color = "#4caf50";

    const store = loadLocal();
    if (!store[currentTodayKey]) store[currentTodayKey] = {};
    store[currentTodayKey][currentDiff] = true;
    saveLocal(store);
  } else {
    elMessage.textContent = "Not quite, try again.";
    elMessage.style.color = "#ff6b6b";
  }
}

// ---- Hint toggle ----
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

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    setsData = await res.json();
  } catch (e) {
    console.error(e);
    elQuestion.textContent =
      "Error loading today's puzzles. Please try again later.";
    return;
  }

  setDifficulty("easy");
}

// ---- Events ----
btnEasy.addEventListener("click", () => setDifficulty("easy"));
btnMedium.addEventListener("click", () => setDifficulty("medium"));
btnHard.addEventListener("click", () => setDifficulty("hard"));

elSubmit.addEventListener("click", checkAnswer);
elAnswer.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkAnswer();
});

elHintBtn.addEventListener("click", toggleHint);

themeBlue.addEventListener("click", () => applyTheme("blue"));
themeOrange.addEventListener("click", () => applyTheme("orange"));
themeGold.addEventListener("click", () => applyTheme("gold"));

// ---- Go ----
initBrain();
