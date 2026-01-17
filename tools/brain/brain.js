// ================================
// Daily Brain — EverydayTools.uk
// Full front-end logic
// - 5 questions per level (easy/medium/hard)
// - Unlock: medium after easy, hard after medium
// - Streak + best (Easy+Medium rule)
// - Local best days
// - Global leaderboard via API
// - Email subscription via API
// ================================

// ---- Config ----
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";
const THEME_KEY = "et_brain_theme_v1";
const PROGRESS_KEY = "et_brain_progress_v1";
const GLOBAL_NAME_KEY = "et_brain_name_v1";
const SUB_STATUS_KEY = "et_brain_subscribed_v1";

// API endpoints (adjust if your paths differ)
const SCORE_API = "/api/brain-score";
const LEADERBOARD_API = "/api/brain-leaderboard";
const SUBSCRIBE_API = "/api/brain-subscribe";
const UNSUBSCRIBE_API = "/api/brain-unsubscribe";

// ---- State ----
let setsData = null;
let currentDiff = "easy";
let currentList = [];
let currentIndex = 0;
let levelScore = 0; // score on current level run
let progress = {};  // per-day progress
let leaderboardLoaded = false;

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

const normalize = (str) => String(str || "").trim().toLowerCase();

// ---- Storage helpers ----
function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- DOM refs ----
const elResetTime = document.getElementById("resetTime");
const elQuestion = document.getElementById("questionText");
const elAnswer = document.getElementById("answerInput");
const elSubmit = document.getElementById("submitBtn");
const elHintBtn = document.getElementById("hintBtn");
const elHintText = document.getElementById("hintText");
const elMessage = document.getElementById("message");
const elLevelLabel = document.getElementById("levelLabel");

const btnEasy = document.getElementById("btnEasy");
const btnMedium = document.getElementById("btnMedium");
const btnHard = document.getElementById("btnHard");

const themeBlue = document.getElementById("themeBlue");
const themeOrange = document.getElementById("themeOrange");
const themeGold = document.getElementById("themeGold");

const elStreakText = document.getElementById("streakText");
const elTodayScore = document.getElementById("todayScore");
const elBestDaysBody = document.getElementById("bestDaysBody");
const elBestDaysEmpty = document.getElementById("bestDaysEmpty");
const elLeaderboardBody = document.getElementById("leaderboardBody");
const elLeaderboardEmpty = document.getElementById("leaderboardEmpty");

const elGlobalNameInput = document.getElementById("globalNameInput");
const elSubmitScoreBtn = document.getElementById("submitScoreBtn");

const elSubEmailInput = document.getElementById("subEmailInput");
const elSubBtn = document.getElementById("subBtn");
const elUnsubBtn = document.getElementById("unsubBtn");
const elSubStatus = document.getElementById("subStatus");

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
  const saved = localStorage.getItem(THEME_KEY) || "blue";
  applyTheme(saved);
}

// ---- Progress structure ----
// progress = {
//   "2026-01-17": {
//     easy: { correct: number, total: number, completed: bool },
//     medium: { ... },
//     hard: { ... }
//   },
//   ...
// }

function todayProgress() {
  const key = todayKey();
  if (!progress[key]) {
    progress[key] = {};
  }
  return progress[key];
}

function markLevelResult(diff, correct, total) {
  const day = todayProgress();
  if (!day[diff]) {
    day[diff] = { correct: 0, total: 0, completed: false };
  }
  day[diff].correct = correct;
  day[diff].total = total;
  day[diff].completed = true;
  saveJson(PROGRESS_KEY, progress);
}

function isLevelCompleted(dateKey, diff) {
  const day = progress[dateKey];
  if (!day || !day[diff]) return false;
  return !!day[diff].completed;
}

function canPlayDifficulty(diff) {
  const key = todayKey();
  if (diff === "easy") return true;
  if (diff === "medium") return isLevelCompleted(key, "easy");
  if (diff === "hard") return isLevelCompleted(key, "medium");
  return false;
}

function styleDifficultyButton(btn, unlocked, active = false) {
  btn.disabled = !unlocked;
  btn.style.opacity = unlocked ? "1" : "0.4";
  btn.style.cursor = unlocked ? "pointer" : "not-allowed";
  btn.classList.toggle("active", active);
}

function applyLocksAndActive() {
  const key = todayKey();
  const easyUnlocked = true;
  const mediumUnlocked = isLevelCompleted(key, "easy");
  const hardUnlocked = isLevelCompleted(key, "medium");

  styleDifficultyButton(btnEasy, easyUnlocked, currentDiff === "easy");
  styleDifficultyButton(btnMedium, mediumUnlocked, currentDiff === "medium");
  styleDifficultyButton(btnHard, hardUnlocked, currentDiff === "hard");
}

// ---- Load daily questions ----
// Expected structure for each difficulty:
// "easy": [ { q: "...", a: "answer", hint: "...", explanation: "..." }, ... ]
function loadTodayQuestions(diff) {
  const day = todayKey();
  const daySet = setsData?.[day];
  if (!daySet || !Array.isArray(daySet[diff])) return [];
  return daySet[diff].slice(0, 5); // first up to 5
}

// ---- Streak + best calculation ----
// Streak rule: a day counts if easy + medium are both completed that date.
function computeStreakInfo() {
  const dates = Object.keys(progress).sort(); // ascending
  if (!dates.length) return { currentStreak: 0, bestStreak: 0 };

  let currentStreak = 0;
  let bestStreak = 0;
  let prevDate = null;

  for (const d of dates) {
    const day = progress[d];
    const valid =
      day &&
      day.easy &&
      day.easy.completed &&
      day.medium &&
      day.medium.completed;

    if (!valid) {
      // break streak
      currentStreak = 0;
      prevDate = null;
      continue;
    }

    if (!prevDate) {
      currentStreak = 1;
      prevDate = d;
    } else {
      const prevTime = Date.parse(prevDate + "T00:00:00Z");
      const currTime = Date.parse(d + "T00:00:00Z");
      const diffDays = Math.round(
        (currTime - prevTime) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
      prevDate = d;
    }

    if (currentStreak > bestStreak) bestStreak = currentStreak;
  }

  return { currentStreak, bestStreak };
}

function updateStreakUi() {
  const { currentStreak, bestStreak } = computeStreakInfo();
  elStreakText.textContent = `Streak 🔥 ${currentStreak} · Best ${bestStreak}`;
}

// ---- Today score + best days ----
function getDayTotalScore(dayKey) {
  const day = progress[dayKey];
  if (!day) return 0;
  let sum = 0;
  ["easy", "medium", "hard"].forEach((d) => {
    if (day[d] && typeof day[d].correct === "number") {
      sum += day[d].correct;
    }
  });
  return sum;
}

function updateTodayScoreUi() {
  const key = todayKey();
  const todayTotalCorrect = getDayTotalScore(key);
  const maxQuestions =
    (setsData?.[key]?.easy?.length || 0) +
    (setsData?.[key]?.medium?.length || 0) +
    (setsData?.[key]?.hard?.length || 0);
  const max = maxQuestions || 15; // fallback
  elTodayScore.textContent = `${todayTotalCorrect}/${max}`;
}

function updateBestDaysUi() {
  const rows = Object.keys(progress)
    .map((d) => ({
      date: d,
      score: getDayTotalScore(d),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || (a.date < b.date ? -1 : 1))
    .slice(0, 10);

  elBestDaysBody.innerHTML = "";
  if (!rows.length) {
    elBestDaysEmpty.style.display = "block";
    return;
  }
  elBestDaysEmpty.style.display = "none";

  for (const row of rows) {
    const tr = document.createElement("tr");
    const tdDate = document.createElement("td");
    const tdScore = document.createElement("td");
    tdDate.textContent = row.date;
    tdScore.textContent = row.score;
    tdScore.className = "score";
    tr.appendChild(tdDate);
    tr.appendChild(tdScore);
    elBestDaysBody.appendChild(tr);
  }
}

// ---- Question rendering ----
function setLevelLabel(diff) {
  elLevelLabel.textContent = diff.toUpperCase();
}

function renderQuestion() {
  const item = currentList[currentIndex];
  if (!item) return;
  const total = currentList.length;
  const prefix = `(${currentIndex + 1}/${total}) `;
  elQuestion.textContent = prefix + (item.q || "");

  elAnswer.value = "";
  elAnswer.disabled = false;
  elAnswer.focus();
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
  levelScore = 0;

  setLevelLabel(diff);
  applyLocksAndActive();

  if (!currentList.length) {
    elQuestion.textContent = "No puzzles for today.";
    elAnswer.value = "";
    elAnswer.disabled = true;
    elHintBtn.style.display = "none";
    elHintText.style.display = "none";
    elMessage.textContent = "";
    return;
  }

  renderQuestion();
}

// ---- Answer check ----
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
    levelScore += 1;
    elMessage.textContent = "Correct!";
    elMessage.style.color = "#4caf50";
  } else {
    elMessage.textContent = `Wrong. Correct answer: ${expected}`;
    elMessage.style.color = "#ff6b6b";
  }

  currentIndex++;

  if (currentIndex >= currentList.length) {
    // finished this level
    markLevelResult(currentDiff, levelScore, currentList.length);
    updateTodayScoreUi();
    updateBestDaysUi();
    updateStreakUi();
    applyLocksAndActive();

    elQuestion.textContent = `Finished ${currentDiff.toUpperCase()}! Score: ${levelScore}/${currentList.length}`;
    elAnswer.value = "";
    elAnswer.disabled = true;
    elHintBtn.style.display = "none";
    elHintText.style.display = "none";

    const key = todayKey();
    const day = progress[key];

    if (currentDiff === "easy" && day.easy?.completed && !day.medium?.completed) {
      elMessage.textContent += " — Medium is now unlocked!";
      elMessage.style.color = "#4caf50";
    } else if (
      currentDiff === "medium" &&
      day.medium?.completed &&
      !day.hard?.completed
    ) {
      elMessage.textContent += " — Hard is now unlocked!";
      elMessage.style.color = "#4caf50";
    }

    return;
  }

  setTimeout(renderQuestion, 650);
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

// ---- Global leaderboard ----
async function loadLeaderboard() {
  try {
    const res = await fetch(LEADERBOARD_API, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.scores || [];

    elLeaderboardBody.innerHTML = "";
    if (!list.length) {
      elLeaderboardEmpty.style.display = "block";
      return;
    }
    elLeaderboardEmpty.style.display = "none";

    list
      .slice(0, 20)
      .forEach((row, idx) => {
        const tr = document.createElement("tr");
        const tdRank = document.createElement("td");
        const tdName = document.createElement("td");
        const tdScore = document.createElement("td");

        tdRank.textContent = idx + 1;
        tdName.textContent = row.name || "Player";
        tdScore.textContent = row.score ?? row.value ?? 0;
        tdScore.className = "score";

        tr.appendChild(tdRank);
        tr.appendChild(tdName);
        tr.appendChild(tdScore);
        elLeaderboardBody.appendChild(tr);
      });

    leaderboardLoaded = true;
  } catch (err) {
    console.error("Leaderboard error:", err);
    elLeaderboardEmpty.style.display = "block";
    elLeaderboardEmpty.textContent = "Error loading leaderboard.";
  }
}

async function submitScore() {
  const name = (elGlobalNameInput.value || "").trim() || "Player";
  const key = todayKey();
  const score = getDayTotalScore(key);

  if (!score) {
    elMessage.textContent = "Play today's puzzles to get a score first.";
    elMessage.style.color = "#ffcc00";
    return;
  }

  try {
    elSubmitScoreBtn.disabled = true;
    elSubmitScoreBtn.textContent = "Submitting…";

    await fetch(SCORE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score, date: key }),
    });

    localStorage.setItem(GLOBAL_NAME_KEY, name);
    elMessage.textContent = "Score submitted to the global leaderboard!";
    elMessage.style.color = "#4caf50";

    // reload leaderboard
    await loadLeaderboard();
  } catch (err) {
    console.error("Submit score error:", err);
    elMessage.textContent = "Could not submit score. Please try again later.";
    elMessage.style.color = "#ff6b6b";
  } finally {
    elSubmitScoreBtn.disabled = false;
    elSubmitScoreBtn.textContent = "Submit score";
  }
}

// ---- Subscription ----
function updateSubUi() {
  const status = localStorage.getItem(SUB_STATUS_KEY) || "none";
  if (status === "subscribed") {
    elSubStatus.textContent = "✅ Subscribed to Daily Brain emails.";
    elSubStatus.style.color = "#4caf50";
  } else if (status === "unsubscribed") {
    elSubStatus.textContent = "You are unsubscribed.";
    elSubStatus.style.color = "#cccccc";
  } else {
    elSubStatus.textContent = "";
  }
}

async function subscribeEmail() {
  const email = (elSubEmailInput.value || "").trim();
  if (!email || !email.includes("@")) {
    elSubStatus.textContent = "Enter a valid email first.";
    elSubStatus.style.color = "#ffcc00";
    return;
  }
  try {
    elSubBtn.disabled = true;
    elSubStatus.textContent = "Subscribing…";
    elSubStatus.style.color = "#cccccc";

    await fetch(SUBSCRIBE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    localStorage.setItem(SUB_STATUS_KEY, "subscribed");
    updateSubUi();
  } catch (err) {
    console.error("Subscribe error:", err);
    elSubStatus.textContent = "Could not subscribe right now.";
    elSubStatus.style.color = "#ff6b6b";
  } finally {
    elSubBtn.disabled = false;
  }
}

async function unsubscribeEmail() {
  const email = (elSubEmailInput.value || "").trim();
  if (!email || !email.includes("@")) {
    elSubStatus.textContent = "Enter your email to unsubscribe.";
    elSubStatus.style.color = "#ffcc00";
    return;
  }
  try {
    elUnsubBtn.disabled = true;
    elSubStatus.textContent = "Unsubscribing…";
    elSubStatus.style.color = "#cccccc";

    await fetch(UNSUBSCRIBE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    localStorage.setItem(SUB_STATUS_KEY, "unsubscribed");
    updateSubUi();
  } catch (err) {
    console.error("Unsubscribe error:", err);
    elSubStatus.textContent = "Could not unsubscribe right now.";
    elSubStatus.style.color = "#ff6b6b";
  } finally {
    elUnsubBtn.disabled = false;
  }
}

// ---- Init ----
async function initBrain() {
  initTheme();
  progress = loadJson(PROGRESS_KEY, {});
  startCountdown();

  // Restore global name if any
  elGlobalNameInput.value = localStorage.getItem(GLOBAL_NAME_KEY) || "";

  // Subscription UI
  updateSubUi();

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    setsData = await res.json();
  } catch (err) {
    console.error("Data load error:", err);
    elQuestion.textContent = "Failed to load today's puzzles.";
    elAnswer.disabled = true;
    return;
  }

  applyLocksAndActive();
  updateTodayScoreUi();
  updateBestDaysUi();
  updateStreakUi();

  // start on easy
  setDifficulty("easy");

  // load leaderboard once
  loadLeaderboard();
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

elSubmitScoreBtn.addEventListener("click", submitScore);

elSubBtn.addEventListener("click", subscribeEmail);
elUnsubBtn.addEventListener("click", unsubscribeEmail);

// ---- Countdown ----
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

// ---- Go ----
initBrain();
