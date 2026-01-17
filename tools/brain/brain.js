// ================================
// EverydayTools.uk — Daily Brain
// Multi-question levels (5 per level)
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v2";
const FILTER_KEY = "et_brain_filter_v1"; // kept for compatibility if needed
const SUBSCRIBE_KEY = "et_brain_subscribed";

const API_SCORE = "/api/brain-score";
const API_LEADERBOARD = "/api/brain-leaderboard";
const API_SUBSCRIBE = "/api/brain-subscribe";

// ---------- Date & time helpers ----------

const todayKey = () => new Date().toISOString().slice(0, 10);

const msToNextUtcMidnight = () => {
  const d = new Date();
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) -
    Date.now()
  );
};

const fmtHMS = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

// ---------- Normalization helpers ----------

const normalizeAnswer = (value) => {
  if (value == null) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?'"’”“\-]/g, "");
};

const pick = (obj, key, fallback) =>
  obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : fallback;

// ---------- DOM refs ----------

const el = {
  resetTimer: document.getElementById("reset-timer"),
  tabs: document.getElementById("brain-tabs"),
  tabEasy: document.getElementById("tab-easy"),
  tabMedium: document.getElementById("tab-medium"),
  tabHard: document.getElementById("tab-hard"),

  levelCard: document.getElementById("brain-level-card"),
  levelLabel: document.getElementById("level-label"),
  levelHelp: document.getElementById("level-help"),
  questions: document.getElementById("brain-questions"),
  submitBtn: document.getElementById("submit-level-btn"),
  levelSummary: document.getElementById("level-summary"),
  levelMessage: document.getElementById("level-message"),

  todayScore: document.getElementById("today-score"),
  todayStreak: document.getElementById("today-streak"),
  globalNameInput: document.getElementById("global-name-input"),

  bestDaysBody: document.getElementById("best-days-body"),
  leaderboardBody: document.getElementById("global-leaderboard-body"),

  subscribeEmail: document.getElementById("subscribe-email"),
  subscribeBtn: document.getElementById("subscribe-btn"),
  subscribeStatus: document.getElementById("subscribe-status"),
  subscribeSection: document.getElementById("subscribe-section"),
};

// ---------- State ----------

const LEVELS = ["easy", "medium", "hard"];
const LEVEL_CONFIG = {
  easy: {
    label: "Easy",
    help: "Start here. Short warm-up questions to get your brain moving.",
    pointsPerCorrect: 2,
  },
  medium: {
    label: "Medium",
    help: "A bit trickier. You’ll unlock this after submitting Easy.",
    pointsPerCorrect: 3,
  },
  hard: {
    label: "Hard",
    help: "Challenging questions to finish the day.",
    pointsPerCorrect: 5,
  },
};

let dataByDate = {};
let currentLevel = "easy";

let state = {
  date: todayKey(),
  answers: {
    easy: ["", "", "", "", ""],
    medium: ["", "", "", "", ""],
    hard: ["", "", "", "", ""],
  },
  correctness: {
    easy: [null, null, null, null, null], // true / false / null
    medium: [null, null, null, null, null],
    hard: [null, null, null, null, null],
  },
  submitted: {
    easy: false,
    medium: false,
    hard: false,
  },
  scores: {
    easy: 0,
    medium: 0,
    hard: 0,
  },
  totalScore: 0,
  bestDays: [], // local best days
  streak: 0,
  lastPlayedDate: null,
  globalName: "Player",
};

// ---------- Local storage ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    // Only keep state for today; drop previous-day answers
    if (parsed.date === todayKey()) {
      state = {
        ...state,
        ...parsed,
        answers: { ...state.answers, ...parsed.answers },
        correctness: { ...state.correctness, ...parsed.correctness },
        submitted: { ...state.submitted, ...parsed.submitted },
        scores: { ...state.scores, ...parsed.scores },
      };
    } else {
      // Carry streak + bestDays + globalName forward
      state.streak = parsed.streak || 0;
      state.bestDays = parsed.bestDays || [];
      state.globalName = parsed.globalName || "Player";
      state.lastPlayedDate = parsed.date || null;
      state.date = todayKey();
    }
  } catch (err) {
    console.error("Failed to load brain state", err);
  }
}

function saveState() {
  try {
    const toStore = { ...state };
    localStorage.setItem(STORE_KEY, JSON.stringify(toStore));
  } catch (err) {
    console.error("Failed to save brain state", err);
  }
}

// ---------- Streak + best days helpers ----------

function updateStreakAfterSubmission() {
  const today = todayKey();
  if (!state.lastPlayedDate) {
    state.streak = 1;
  } else {
    const last = new Date(state.lastPlayedDate);
    const todayDate = new Date(today);
    const diffDays = Math.round(
      (todayDate - last) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      state.streak = (state.streak || 0) + 1;
    } else if (diffDays > 1) {
      state.streak = 1;
    }
  }
  state.lastPlayedDate = today;
}

function updateBestDays() {
  const today = todayKey();
  const existingIndex = state.bestDays.findIndex((d) => d.date === today);
  if (existingIndex >= 0) {
    state.bestDays[existingIndex].score = state.totalScore;
  } else {
    state.bestDays.push({ date: today, score: state.totalScore });
  }
  state.bestDays.sort((a, b) => b.score - a.score);
  state.bestDays = state.bestDays.slice(0, 10);
}

// ---------- Rendering: questions ----------

function getTodaySet() {
  const today = todayKey();
  const fromKey = dataByDate[today];
  if (fromKey) return fromKey;

  // Fallback: if data is array with date property
  if (Array.isArray(dataByDate)) {
    return dataByDate.find((d) => d.date === today) || null;
  }

  return null;
}

function getQuestionsForLevel(level) {
  const todaySet = getTodaySet();
  if (!todaySet) return [];

  const arr = todaySet[level] || [];
  // Ensure always 5 slots (even if fewer questions present)
  const filled = [];
  for (let i = 0; i < 5; i++) {
    filled.push(
      arr[i] || {
        q: "No question configured.",
        a: "",
        hint: "",
        explanation:
          "This slot has no data yet. Update the JSON file for this day and level.",
      }
    );
  }
  return filled;
}

function renderQuestions(level) {
  const container = el.questions;
  container.innerHTML = "";

  const questions = getQuestionsForLevel(level);
  const answers = state.answers[level];
  const correctness = state.correctness[level];
  const submitted = state.submitted[level];

  questions.forEach((qObj, idx) => {
    const qText = pick(qObj, "q", "Question text missing.");
    const hint = pick(qObj, "hint", "");
    const explanation = pick(
      qObj,
      "explanation",
      "This answer is correct because of the way the puzzle is set up."
    );
    const correctAnswer = pick(qObj, "a", "");

    const wrapper = document.createElement("div");
    wrapper.className = "brain-question";
    wrapper.dataset.index = String(idx);

    const header = document.createElement("div");
    header.className = "brain-question-header";

    const title = document.createElement("div");
    title.className = "brain-question-title";
    title.textContent = `Question ${idx + 1}`;

    const status = document.createElement("div");
    status.className = "brain-question-status";

    if (submitted && correctness[idx] !== null) {
      if (correctness[idx]) {
        status.textContent = "Correct";
        status.classList.add("correct");
      } else {
        status.textContent = "Check explanation";
        status.classList.add("wrong");
      }
    } else {
      status.textContent = "";
    }

    header.appendChild(title);
    header.appendChild(status);

    const indexLabel = document.createElement("div");
    indexLabel.className = "brain-question-index";
    indexLabel.textContent = LEVEL_CONFIG[level].label;

    header.appendChild(indexLabel);

    const text = document.createElement("div");
    text.className = "brain-question-text";
    text.textContent = qText;

    const inputRow = document.createElement("div");
    inputRow.className = "brain-input-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Your answer…";
    input.value = answers[idx] || "";
    input.dataset.level = level;
    input.dataset.index = String(idx);

    input.addEventListener("input", (e) => {
      const lv = e.target.dataset.level;
      const index = Number(e.target.dataset.index);
      state.answers[lv][index] = e.target.value;
      // Once user edits after submission, reset correctness for that question
      if (state.submitted[lv]) {
        state.correctness[lv][index] = null;
      }
      saveState();
    });

    inputRow.appendChild(input);

    const hintToggle = document.createElement("span");
    hintToggle.className = "brain-hint";
    hintToggle.textContent = hint ? "Show hint" : "";
    let hintVisible = false;

    const hintTextEl = document.createElement("div");
    hintTextEl.className = "brain-hint-text";
    hintTextEl.textContent = hint || "";
    hintTextEl.style.display = "none";

    if (hint) {
      hintToggle.addEventListener("click", () => {
        hintVisible = !hintVisible;
        hintTextEl.style.display = hintVisible ? "block" : "none";
        hintToggle.textContent = hintVisible ? "Hide hint" : "Show hint";
      });
    }

    const explanationEl = document.createElement("div");
    explanationEl.className = "brain-explanation";

    if (submitted) {
      const wasCorrect = correctness[idx];
      const normalizedCorrect = normalizeAnswer(correctAnswer);
      explanationEl.innerHTML = `
        <strong>Answer:</strong> ${correctAnswer || "—"}<br />
        <span>${explanation}</span>
      `;
      // No need to show the explanation label if we truly have nothing
      if (!correctAnswer && !explanation) {
        explanationEl.textContent = "";
      }
    } else {
      explanationEl.textContent = "";
    }

    wrapper.appendChild(header);
    wrapper.appendChild(text);
    wrapper.appendChild(inputRow);
    if (hint) {
      wrapper.appendChild(hintToggle);
      wrapper.appendChild(hintTextEl);
    }
    wrapper.appendChild(explanationEl);

    container.appendChild(wrapper);
  });
}

// ---------- Rendering: level UI ----------

function updateLevelUI(level) {
  currentLevel = level;
  const cfg = LEVEL_CONFIG[level];

  el.levelLabel.textContent = cfg.label;
  el.levelHelp.textContent = cfg.help;

  const submitted = state.submitted[level];
  const score = state.scores[level];

  if (!submitted) {
    el.levelSummary.textContent = `You haven’t submitted ${cfg.label} yet today.`;
    el.submitBtn.textContent = `Submit ${cfg.label}`;
  } else {
    const correctness = state.correctness[level];
    const correctCount = correctness.filter((x) => x === true).length;
    el.levelSummary.textContent = `You answered ${correctCount}/5 correctly in ${cfg.label} today. (+${score} pts)`;
    el.submitBtn.textContent = `Resubmit ${cfg.label}`;
  }

  el.levelMessage.textContent = "";
  el.levelMessage.className = "brain-message";

  renderQuestions(level);
  updateLevelLocks();
}

// ---------- Level locking ----------

function updateLevelLocks() {
  const { submitted } = state;

  // Easy: always unlocked
  el.tabEasy.classList.remove("locked");

  // Medium
  if (submitted.easy) {
    el.tabMedium.classList.remove("locked");
  } else {
    el.tabMedium.classList.add("locked");
  }

  // Hard
  if (submitted.medium) {
    el.tabHard.classList.remove("locked");
  } else {
    el.tabHard.classList.add("locked");
  }

  // Active tab styling
  [el.tabEasy, el.tabMedium, el.tabHard].forEach((btn) =>
    btn.classList.remove("active")
  );
  if (currentLevel === "easy") el.tabEasy.classList.add("active");
  if (currentLevel === "medium") el.tabMedium.classList.add("active");
  if (currentLevel === "hard") el.tabHard.classList.add("active");
}

// ---------- Score calculation ----------

function calculateLevelScore(level) {
  const questions = getQuestionsForLevel(level);
  const answers = state.answers[level];
  const correctness = state.correctness[level];

  let score = 0;
  const pts = LEVEL_CONFIG[level].pointsPerCorrect;

  questions.forEach((qObj, idx) => {
    const expected = normalizeAnswer(pick(qObj, "a", ""));
    const given = normalizeAnswer(answers[idx] || "");

    const isCorrect = expected && given && expected === given;
    correctness[idx] = isCorrect;
    if (isCorrect) score += pts;
  });

  state.correctness[level] = correctness;
  state.scores[level] = score;
}

function calculateTotalScore() {
  const { scores } = state;
  state.totalScore = scores.easy + scores.medium + scores.hard;
}

// ---------- Submit level ----------

async function handleSubmitLevel() {
  const level = currentLevel;
  const cfg = LEVEL_CONFIG[level];

  // Make sure there is data for today
  const todaySet = getTodaySet();
  if (!todaySet || !getQuestionsForLevel(level).length) {
    el.levelMessage.textContent =
      "No puzzle found for today. Please check the data file on the server.";
    el.levelMessage.className = "brain-message error";
    return;
  }

  // At least require some attempt (one non-empty answer)
  const anyAnswer = state.answers[level].some((a) => (a || "").trim() !== "");
  if (!anyAnswer) {
    el.levelMessage.textContent = "Try at least one question before submitting.";
    el.levelMessage.className = "brain-message error";
    return;
  }

  calculateLevelScore(level);
  calculateTotalScore();

  // Mark level as submitted, which unlocks the next level (even if some are wrong)
  state.submitted[level] = true;

  // Streak + best days update when user first submits anything today
  updateStreakAfterSubmission();
  updateBestDays();

  saveState();
  updateLevelUI(level);
  updateTodaySection();
  renderBestDays();

  // Finally, send score to API (best effort)
  await sendScoreToServer().catch((err) =>
    console.error("Failed to send score", err)
  );

  el.levelMessage.textContent = `Submitted ${cfg.label}. You can review explanations and then move to the next level.`;
  el.levelMessage.className = "brain-message success";
}

// ---------- Today section ----------

function updateTodaySection() {
  el.todayScore.textContent = state.totalScore;
  el.todayStreak.textContent = state.streak || 0;
  el.globalNameInput.value = state.globalName || "Player";
}

// ---------- Best days rendering ----------

function renderBestDays() {
  const body = el.bestDaysBody;
  body.innerHTML = "";

  if (!state.bestDays.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = "Play a few days to see your best scores here.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  state.bestDays.forEach((d) => {
    const tr = document.createElement("tr");
    const tdDate = document.createElement("td");
    const tdScore = document.createElement("td");

    tdDate.textContent = d.date;
    tdScore.textContent = `${d.score} pts`;

    tr.appendChild(tdDate);
    tr.appendChild(tdScore);

    body.appendChild(tr);
  });
}

// ---------- Global leaderboard ----------

async function loadLeaderboard() {
  try {
    const res = await fetch(API_LEADERBOARD, { method: "GET" });
    if (!res.ok) throw new Error("Leaderboard HTTP " + res.status);
    const json = await res.json();

    const list = Array.isArray(json) ? json : json.rows || [];
    const tbody = el.leaderboardBody;
    tbody.innerHTML = "";

    if (!list.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "No global scores yet.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    list.slice(0, 20).forEach((row, idx) => {
      const tr = document.createElement("tr");

      const tdRank = document.createElement("td");
      const tdName = document.createElement("td");
      const tdScore = document.createElement("td");
      const tdDay = document.createElement("td");

      tdRank.textContent = idx + 1;
      tdName.textContent = row.global_name || row.name || "Player";
      tdScore.textContent = `${row.score} pts`;
      tdDay.textContent = row.day || row.date || "";

      tr.appendChild(tdRank);
      tr.appendChild(tdName);
      tr.appendChild(tdScore);
      tr.appendChild(tdDay);

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Leaderboard error", err);
    const tbody = el.leaderboardBody;
    tbody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Leaderboard is temporarily unavailable.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

async function sendScoreToServer() {
  try {
    const payload = {
      score: state.totalScore,
      date: todayKey(),
      utc: new Date().toISOString(),
      globalName: state.globalName || "Player",
    };

    const res = await fetch(API_SCORE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn("Score API returned HTTP " + res.status);
    }
  } catch (err) {
    console.error("Failed to send score", err);
  }

  // Refresh leaderboard in the background
  loadLeaderboard().catch((err) =>
    console.error("Leaderboard refresh failed", err)
  );
}

// ---------- Subscription ----------

function initSubscriptionUI() {
  if (!el.subscribeSection) return;

  const already = localStorage.getItem(SUBSCRIBE_KEY);
  if (already === "subscribed") {
    el.subscribeStatus.textContent = "✅ Subscribed";
    if (el.subscribeBtn) el.subscribeBtn.textContent = "Unsubscribe";
  }
}

async function handleSubscribeClick() {
  if (!el.subscribeBtn) return;

  const already = localStorage.getItem(SUBSCRIBE_KEY);
  if (already === "subscribed") {
    // Local-only unsubscribe
    localStorage.removeItem(SUBSCRIBE_KEY);
    el.subscribeStatus.textContent = "You have been unsubscribed locally.";
    el.subscribeBtn.textContent = "Subscribe";
    return;
  }

  const email = (el.subscribeEmail.value || "").trim();
  if (!email || !email.includes("@")) {
    el.subscribeStatus.textContent = "Please enter a valid email address.";
    return;
  }

  el.subscribeBtn.disabled = true;
  el.subscribeStatus.textContent = "Subscribing…";

  try {
    const res = await fetch(API_SUBSCRIBE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "daily-brain" }),
    });
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    const json = await res.json();
    if (json && json.ok) {
      el.subscribeStatus.textContent = "✅ Subscribed";
      el.subscribeBtn.textContent = "Unsubscribe";
      localStorage.setItem(SUBSCRIBE_KEY, "subscribed");
    } else {
      el.subscribeStatus.textContent =
        "Subscription saved, but confirmation email may be delayed.";
    }
  } catch (err) {
    console.error("Subscribe error", err);
    el.subscribeStatus.textContent =
      "Could not reach the server. Please try again later.";
  } finally {
    el.subscribeBtn.disabled = false;
  }
}

// ---------- Reset timer ----------

function startResetTimer() {
  const tick = () => {
    const ms = msToNextUtcMidnight();
    el.resetTimer.textContent = `Resets in ${fmtHMS(ms)} (UTC)`;
    if (ms <= 0) {
      // At next midnight reload the page to fetch the new day
      window.location.reload();
    }
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- Global name ----------

function initGlobalName() {
  el.globalNameInput.addEventListener("input", (e) => {
    const val = (e.target.value || "").trim();
    state.globalName = val || "Player";
    saveState();
  });
}

// ---------- Tabs events ----------

function initTabs() {
  el.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-level]");
    if (!btn) return;
    const level = btn.getAttribute("data-level");
    if (!level) return;

    // Respect locks
    if (level === "medium" && !state.submitted.easy) {
      el.levelMessage.textContent =
        "Finish and submit Easy once to unlock Medium.";
      el.levelMessage.className = "brain-message error";
      return;
    }
    if (level === "hard" && !state.submitted.medium) {
      el.levelMessage.textContent =
        "Finish and submit Medium once to unlock Hard.";
      el.levelMessage.className = "brain-message error";
      return;
    }

    updateLevelUI(level);
  });
}

// ---------- Data loading ----------

async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Data HTTP " + res.status);
    const json = await res.json();

    if (Array.isArray(json)) {
      // Array with {date, easy, medium, hard}
      const map = {};
      json.forEach((entry) => {
        if (entry && entry.date) map[entry.date] = entry;
      });
      dataByDate = map;
    } else if (json && typeof json === "object") {
      // Already keyed by date
      dataByDate = json;
    } else {
      throw new Error("Unexpected data structure");
    }

    const todaySet = getTodaySet();
    if (!todaySet) {
      el.levelMessage.textContent =
        "No puzzle configured for today in the data file.";
      el.levelMessage.className = "brain-message error";
    }

    // Render initial level
    updateLevelUI(currentLevel);
  } catch (err) {
    console.error("Failed to load puzzles", err);
    el.levelMessage.textContent =
      "Could not load today's puzzles. Please check the data file on the server.";
    el.levelMessage.className = "brain-message error";
  }
}

// ---------- Init ----------

function init() {
  loadState();
  startResetTimer();
  initTabs();
  initGlobalName();
  initSubscriptionUI();

  if (el.submitBtn) {
    el.submitBtn.addEventListener("click", handleSubmitLevel);
  }
  if (el.subscribeBtn) {
    el.subscribeBtn.addEventListener("click", handleSubscribeClick);
  }

  updateLevelLocks();
  updateTodaySection();
  renderBestDays();
  loadLeaderboard().catch((err) =>
    console.error("Initial leaderboard load failed", err)
  );

  loadData().catch((err) => console.error(err));
}

document.addEventListener("DOMContentLoaded", init);
