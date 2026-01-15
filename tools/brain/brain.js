// ================================
// EverydayTools.uk — Daily Brain
// brain.js — v2.0 Production
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const START_DATE = "2026-01-12";

// ---------- Date & Time Helpers ----------

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

// ---------- Persistent Local State ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return {
        days: {},
        streak: { current: 0, best: 0, lastDay: null },
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed.days) parsed.days = {};
    if (!parsed.streak) {
      parsed.streak = { current: 0, best: 0, lastDay: null };
    }
    return parsed;
  } catch {
    return {
      days: {},
      streak: { current: 0, best: 0, lastDay: null },
    };
  }
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// ---------- Device Hash & Player Name ----------

function getDeviceHash() {
  const key = "et_device_hash";
  let hash = localStorage.getItem(key);
  if (!hash) {
    hash = crypto.randomUUID();
    localStorage.setItem(key, hash);
  }
  return hash;
}

function getPlayerName() {
  let name = localStorage.getItem("et_player_name");
  if (!name || name.trim() === "") {
    name = prompt("Choose your nickname:") || "Player";
    name = name.trim();
    localStorage.setItem("et_player_name", name);
  }
  return name;
}

// ---------- Global Variables ----------

let brainData = null;
let todaySet = null;
let currentLevel = "easy"; // "easy" | "medium" | "hard"

// ---------- Load Puzzles Data ----------

async function loadPuzzles() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Puzzle JSON load failed");
    brainData = await res.json();
    selectTodaySet();
    renderCurrentPuzzle();
  } catch (err) {
    console.error("Daily Brain error:", err);
  }
}

function selectTodaySet() {
  if (!Array.isArray(brainData) || brainData.length === 0) return;

  const today = parseISODate(todayKey());
  const start = parseISODate(START_DATE);
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));

  const idx = Math.max(0, Math.min(brainData.length - 1, diffDays));
  todaySet = brainData[idx] || brainData[0];
}

function getPuzzleForLevel(level) {
  if (!todaySet || !todaySet[level]) {
    return {
      category: "Daily Brain",
      prompt: "No puzzle found for today.",
      hint: "",
      answers: [],
    };
  }
  return todaySet[level];
}

// ---------- UI Rendering (Puzzle) ----------

function renderCurrentPuzzle() {
  const puzzle = getPuzzleForLevel(currentLevel);
  const catEl = document.getElementById("questionCategory");
  const lvlEl = document.getElementById("questionLevel");
  const txtEl = document.getElementById("questionText");
  const hintEl = document.getElementById("hintText");
  const answerInput = document.getElementById("answerInput");

  if (!puzzle) return;

  if (catEl) catEl.textContent = puzzle.category || "";
  if (lvlEl) lvlEl.textContent = currentLevel.toUpperCase();
  if (txtEl) txtEl.textContent = puzzle.prompt || "";
  if (hintEl) {
    hintEl.textContent = "";
    hintEl.dataset.hint = puzzle.hint || "";
  }
  if (answerInput) answerInput.value = "";
}

// ---------- Difficulty Locking ----------

function getUnlockedLevels(dayState) {
  return {
    easy: true,
    medium: dayState.easyCorrect === true,
    hard: dayState.mediumCorrect === true,
  };
}

function initDifficultyTabs() {
  const container = document.getElementById("difficultyTabs");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-level]");
    if (!btn) return;

    const level = btn.dataset.level;
    const state = loadState();
    const today = todayKey();
    const day = state.days[today] || {
      easyCorrect: false,
      mediumCorrect: false,
      hardCorrect: false,
    };
    const unlock = getUnlockedLevels(day);

    if (!unlock[level]) {
      alert("You must solve the previous difficulty first!");
      return;
    }

    currentLevel = level;
    renderCurrentPuzzle();
  });
}

// ---------- Answer Checking & Scoring ----------

function checkAnswer(input, puzzle) {
  if (!input || !puzzle || !Array.isArray(puzzle.answers)) return false;
  const normalized = input.trim().toLowerCase();
  return puzzle.answers.some(
    (a) => normalized === String(a).trim().toLowerCase()
  );
}

function computeScore(day) {
  let score = 0;
  if (day.easyCorrect) score += 5;
  if (day.mediumCorrect) score += 10;
  if (day.hardCorrect) score += 15;
  return score;
}

// ---------- Streaks & Achievements ----------

function updateStreak(state, today) {
  const yesterday = new Date(parseISODate(today));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);

  if (state.days[yKey]?.score > 0) {
    state.streak.current += 1;
  } else {
    state.streak.current = 1;
  }

  if (state.streak.current > state.streak.best) {
    state.streak.best = state.streak.current;
  }

  state.streak.lastDay = today;
}

function renderStreak(state) {
  const today = todayKey();
  const streakEl = document.getElementById("streakValue");
  const bestEl = document.getElementById("bestStreakValue");
  const scoreEl = document.getElementById("todayScoreText");
  const medalEl = document.getElementById("streakMedal");

  const todayState = state.days[today] || { score: 0 };

  if (streakEl) streakEl.textContent = state.streak.current || 0;
  if (bestEl) bestEl.textContent = state.streak.best || 0;
  if (scoreEl) scoreEl.textContent = `${todayState.score}/30`;

  // Achievements
  let medal = "";
  if (state.streak.current >= 30) medal = "💎 Diamond";
  else if (state.streak.current >= 14) medal = "🥇 Gold";
  else if (state.streak.current >= 7) medal = "🥈 Silver";
  else if (state.streak.current >= 3) medal = "🥉 Bronze";

  if (medalEl) medalEl.textContent = medal;
}

// ---------- Local Leaderboard ----------

function renderLocalLeaderboard(state) {
  const box = document.getElementById("localLeaderboard");
  if (!box) return;

  const entries = Object.entries(state.days)
    .filter(([, v]) => v.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (entries.length === 0) {
    box.innerHTML = "<p>No previous days yet.</p>";
    return;
  }

  let html =
    "<table><thead><tr><th>Date</th><th>Score</th></tr></thead><tbody>";
  for (const [day, info] of entries) {
    html += `<tr><td>${day}</td><td>${info.score}</td></tr>`;
  }
  html += "</tbody></table>";
  box.innerHTML = html;
}

// ---------- Global Leaderboard ----------

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

    if (data.ok) {
      renderGlobalLeaderboard(data.rows || []);
    } else if (box) {
      box.textContent = "Could not load leaderboard.";
    }
  } catch (err) {
    console.error("Failed to load global leaderboard:", err);
    if (box) box.textContent = "Could not load leaderboard.";
  }
}

// ---------- Submit Logic ----------

async function handleSubmit() {
  const input = document.getElementById("answerInput");
  if (!input) return;

  const answer = input.value;
  const puzzle = getPuzzleForLevel(currentLevel);
  const correct = checkAnswer(answer, puzzle);

  const state = loadState();
  const today = todayKey();

  if (!state.days[today]) {
    state.days[today] = {
      easyCorrect: false,
      mediumCorrect: false,
      hardCorrect: false,
      score: 0,
      submitted: false,
    };
  }

  const day = state.days[today];

  // Prevent answering same level multiple times
  if (day[currentLevel + "Correct"] !== false) {
    console.log("Already answered this level today.");
    return;
  }

  day[currentLevel + "Correct"] = !!correct;
  day.score = computeScore(day);

  // Only apply streak first time score > 0
  if (!day._streak && day.score > 0) {
    updateStreak(state, today);
    day._streak = true;
  }

  saveState(state);
  renderStreak(state);
  renderLocalLeaderboard(state);

  // Don't submit 0 scores
  if (day.score <= 0) {
    console.log("Score is 0, not submitting.");
    return;
  }

  // Prevent multiple submissions to server
  if (day.submitted) {
    console.log("Already submitted today's score.");
    return;
  }

  try {
    const payload = {
      name: getPlayerName(),
      score: day.score,
      day: today,
      device_hash: getDeviceHash(),
    };

    const res = await fetch("/api/brain-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.ok) {
      day.submitted = true;
      saveState(state);
      loadGlobalLeaderboard();
    } else {
      console.warn("Server rejected score:", data);
    }
  } catch (err) {
    console.error("Failed to send score:", err);
  }
}

// ---------- Hint ----------

function handleShowHint() {
  const hintEl = document.getElementById("hintText");
  if (hintEl) {
    hintEl.textContent = hintEl.dataset.hint || "";
  }
}

// ---------- Share Score ----------

function handleShare() {
  const scoreText =
    document.getElementById("todayScoreText")?.textContent || "0/30";
  const name = getPlayerName();

  if (navigator.share) {
    navigator.share({
      title: "Daily Brain – My Score",
      text: `${name} scored ${scoreText} today on Daily Brain!`,
      url: "https://everydaytools.uk/brain",
    }).catch(() => {});
  } else {
    alert("Sharing is not supported on this device.");
  }
}

// ---------- Countdown ----------

function startCountdown() {
  const el = document.getElementById("countdownText");
  if (!el) return;

  const tick = () => {
    const ms = msToNextUtcMidnight();
    el.textContent = fmtCountdown(ms);
  };

  tick();
  setInterval(tick, 1000);
}

// ---------- Dark Mode ----------

function initDarkMode() {
  const btn = document.getElementById("darkModeToggle");
  if (!btn) return;

  // Restore saved mode
  if (localStorage.getItem("et_dark_mode") === "true") {
    document.body.classList.add("dark");
  }

  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "et_dark_mode",
      document.body.classList.contains("dark")
    );
  });
}

// ---------- Init ----------

function initBrain() {
  const state = loadState();
  renderStreak(state);
  renderLocalLeaderboard(state);
  startCountdown();
  loadGlobalLeaderboard();
  loadPuzzles();
  initDifficultyTabs();
  initDarkMode();

  const submitBtn = document.getElementById("submitAnswerBtn");
  if (submitBtn) submitBtn.addEventListener("click", handleSubmit);

  const hintBtn = document.getElementById("hintBtn");
  if (hintBtn) hintBtn.addEventListener("click", handleShowHint);

  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) shareBtn.addEventListener("click", handleShare);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBrain);
} else {
  initBrain();
}
