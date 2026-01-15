// ================================
// EverydayTools.uk — Daily Brain
// Unified brain.js (local + global)
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const FILTER_KEY = "et_brain_filter_v1";
const SUBSCRIBE_KEY = "et_brain_subscribed";

// If your JSON is date-sequenced from this day:
const START_DATE = "2026-01-12";

// ---------- Date & time helpers ----------

const todayKey = () => new Date().toISOString().slice(0, 10);

const msToNextUtcMidnight = () => {
  const d = new Date();
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) -
    Date.now()
  );
};

const fmtCountdown = (ms) => {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// ---------- Persistent state ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { days: {}, streak: { current: 0, best: 0, lastDay: null } };
    const parsed = JSON.parse(raw);
    if (!parsed.days) parsed.days = {};
    if (!parsed.streak)
      parsed.streak = { current: 0, best: 0, lastDay: null };
    return parsed;
  } catch {
    return { days: {}, streak: { current: 0, best: 0, lastDay: null } };
  }
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// ---------- Device hash for per-device scoring ----------

function getDeviceHash() {
  const key = "et_device_hash";
  let hash = localStorage.getItem(key);
  if (!hash) {
    hash = self.crypto?.randomUUID
      ? crypto.randomUUID()
      : "dev-" + Math.random().toString(36).slice(2);
    localStorage.setItem(key, hash);
  }
  return hash;
}

// ---------- Global variables for today ----------

let brainData = null; // loaded from DATA_URL
let todaySet = null;  // today's puzzles (easy/medium/hard)
let currentLevel = "easy"; // "easy" | "medium" | "hard"

// ---------- Fetch puzzles ----------

async function loadPuzzles() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Failed to load data JSON");
    const data = await res.json();
    brainData = data;

    pickTodaySet();
    renderCurrentPuzzle();
  } catch (err) {
    console.error("Failed to load Daily Brain data:", err);
  }
}

// This assumes DATA_URL is an array of day objects in chronological order.
// Each entry like:
// { date: "2026-01-12", easy: {...}, medium: {...}, hard: {...} }
function pickTodaySet() {
  if (!Array.isArray(brainData) || brainData.length === 0) return;

  const today = parseISODate(todayKey());
  const start = parseISODate(START_DATE);
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));

  const idx = Math.max(0, Math.min(brainData.length - 1, diffDays));
  todaySet = brainData[idx];
  if (!todaySet) todaySet = brainData[0];
}

// ---------- Puzzle rendering & logic ----------

// Expects each puzzle like:
// {
//   category: "Music",
//   prompt: "You have two ropes...",
//   hint: "Use one rope as 30-min timer...",
//   answers: ["45", "45 minutes", "45mins"]
// }

function getPuzzleForLevel(level) {
  if (!todaySet) return null;
  return todaySet[level] || null;
}

function renderCurrentPuzzle() {
  const puzzle = getPuzzleForLevel(currentLevel);
  const catEl = document.getElementById("questionCategory");
  const lvlEl = document.getElementById("questionLevel");
  const txtEl = document.getElementById("questionText");
  const hintEl = document.getElementById("hintText");
  const answerInput = document.getElementById("answerInput");

  if (!puzzle || !catEl || !lvlEl || !txtEl) return;

  catEl.textContent = puzzle.category || "";
  lvlEl.textContent = currentLevel.toUpperCase();
  txtEl.textContent = puzzle.prompt || "";
  if (hintEl) {
    hintEl.textContent = "";
    hintEl.dataset.hint = puzzle.hint || "";
  }
  if (answerInput) {
    answerInput.value = "";
  }
}

function handleDifficultyClick(level) {
  currentLevel = level;
  renderCurrentPuzzle();
}

// Simple answer checker
function checkAnswer(userAnswer, puzzle) {
  if (!puzzle || !userAnswer) return false;
  const normalized = userAnswer.trim().toLowerCase();
  if (!Array.isArray(puzzle.answers)) return false;
  return puzzle.answers.some((a) => normalized === String(a).trim().toLowerCase());
}

// Scoring model:
// You can tweak this easily.
// easy: 5 points, medium: 10, hard: 15 → total max 30
function computeScoreForState(dayState) {
  let score = 0;
  if (dayState.easyCorrect) score += 5;
  if (dayState.mediumCorrect) score += 10;
  if (dayState.hardCorrect) score += 15;
  return score;
}

// ---------- Local leaderboard + streaks ----------

function updateStreak(state, today) {
  const yesterday = new Date(parseISODate(today));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);

  if (state.days[yKey]?.score > 0) {
    // Continue streak
    state.streak.current = (state.streak.current || 0) + 1;
  } else {
    state.streak.current = 1;
  }

  if (!state.streak.best || state.streak.current > state.streak.best) {
    state.streak.best = state.streak.current;
  }

  state.streak.lastDay = today;
}

function renderStreakAndScore(state) {
  const today = todayKey();
  const streakEl = document.getElementById("streakValue");
  const bestEl = document.getElementById("bestStreakValue");
  const scoreEl = document.getElementById("todayScoreText");

  const todayState = state.days[today] || { score: 0 };

  if (streakEl) streakEl.textContent = state.streak.current || 0;
  if (bestEl) bestEl.textContent = state.streak.best || 0;
  if (scoreEl) {
    scoreEl.textContent = `${todayState.score || 0}/30`;
  }
}

function renderLocalLeaderboard(state) {
  const box = document.getElementById("localLeaderboard");
  if (!box) return;

  const entries = Object.entries(state.days)
    .filter(([, v]) => v.score && v.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (entries.length === 0) {
    box.innerHTML = "<p>No previous days yet.</p>";
    return;
  }

  let html = "<table><thead><tr><th>Date</th><th>Score</th></tr></thead><tbody>";
  for (const [day, info] of entries) {
    html += `<tr><td>${day}</td><td>${info.score}</td></tr>`;
  }
  html += "</tbody></table>";
  box.innerHTML = html;
}

// ---------- Global leaderboard ----------

function renderGlobalLeaderboard(rows) {
  const box = document.getElementById("globalLeaderboard");
  if (!box) return;

  if (!rows || rows.length === 0) {
    box.innerHTML = "<p>No global scores yet.</p>";
    return;
  }

  let html = "<ol class='lb-list'>";
  rows.forEach((r, i) => {
    let medal = "";
    if (i === 0) medal = "🥇 ";
    else if (i === 1) medal = "🥈 ";
    else if (i === 2) medal = "🥉 ";

    html += `
      <li>
        ${medal}<strong>${r.name || "Player"}</strong>
        — <span>${r.score}</span>
        <em>${r.date}</em>
      </li>
    `;
  });
  html += "</ol>";

  box.innerHTML = html;
}

async function loadGlobalLeaderboard() {
  const box = document.getElementById("globalLeaderboard");
  if (box) box.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch("/api/brain-leaderboard");
    const data = await res.json();

    if (!data.ok) {
      if (box) box.innerHTML = "<p>Could not load leaderboard.</p>";
      return;
    }

    renderGlobalLeaderboard(data.rows || []);
  } catch (err) {
    console.error("Failed to load global leaderboard:", err);
    if (box) box.innerHTML = "<p>Could not load leaderboard.</p>";
  }
}

// ---------- Countdown ----------

function startCountdown() {
  const el = document.getElementById("countdownText");
  if (!el) return;

  function tick() {
    const ms = msToNextUtcMidnight();
    el.textContent = fmtCountdown(ms);
  }

  tick();
  setInterval(tick, 1000);
}

// ---------- Answer submit flow ----------

async function handleSubmit() {
  const answerInput = document.getElementById("answerInput");
  if (!answerInput) return;

  const userAnswer = answerInput.value;
  const puzzle = getPuzzleForLevel(currentLevel);
  const correct = checkAnswer(userAnswer, puzzle);

  const state = loadState();
  const today = todayKey();

  if (!state.days[today]) {
    state.days[today] = {
      easyCorrect: false,
      mediumCorrect: false,
      hardCorrect: false,
      score: 0,
    };
  }

  const dayState = state.days[today];

  if (currentLevel === "easy") dayState.easyCorrect = !!correct;
  if (currentLevel === "medium") dayState.mediumCorrect = !!correct;
  if (currentLevel === "hard") dayState.hardCorrect = !!correct;

  dayState.score = computeScoreForState(dayState);

  // Update streak only the first time the user gets > 0 score today
  if (!dayState._streakApplied && dayState.score > 0) {
    updateStreak(state, today);
    dayState._streakApplied = true;
  }

  saveState(state);
  renderStreakAndScore(state);
  renderLocalLeaderboard(state);

  // Send to backend (global leaderboard)
  try {
    const payload = {
      name: "Player",
      score: dayState.score,
      day: today,
      device_hash: getDeviceHash(),
    };

    const res = await fetch("/api/brain-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      console.warn("Score not accepted by server:", data);
    } else {
      // Refresh leaderboard
      loadGlobalLeaderboard();
    }
  } catch (err) {
    console.error("Failed to send score:", err);
  }
}

// ---------- Hint button ----------

function handleShowHint() {
  const hintEl = document.getElementById("hintText");
  if (!hintEl) return;
  const hint = hintEl.dataset.hint || "";
  hintEl.textContent = hint;
}

// ---------- Difficulty tabs ----------

function initDifficultyTabs() {
  const container = document.getElementById("difficultyTabs");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-level]");
    if (!btn) return;
    const level = btn.dataset.level;
    if (!level) return;
    currentLevel = level;
    renderCurrentPuzzle();
  });
}

// ---------- Init ----------

function initBrain() {
  const state = loadState();
  renderStreakAndScore(state);
  renderLocalLeaderboard(state);
  startCountdown();
  loadGlobalLeaderboard();
  loadPuzzles();
  initDifficultyTabs();

  // Submit button
  const submitBtn = document.getElementById("submitAnswerBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      handleSubmit();
    });
  }

  // Hint button
  const hintBtn = document.getElementById("hintBtn");
  if (hintBtn) {
    hintBtn.addEventListener("click", handleShowHint);
  }
}

// Auto-init when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBrain);
} else {
  initBrain();
}
