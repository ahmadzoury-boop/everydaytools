// ========================================
// Daily Brain – Final Version (HTML-Matched)
// ========================================

// ---- CONFIG ----
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to-2026-02-10.json";
const STORE_KEY = "et_brain_v1";

// ---- STATE ----
let setsData = null;
let state = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");

// ---- HELPERS ----
const todayKey = () => new Date().toISOString().slice(0, 10);

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function msToNextUtcMidnight() {
  const d = new Date();
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) -
    Date.now()
  );
}

function formatHMS(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

// ---- RESET TIMER ----
function startResetTimer() {
  const el = document.getElementById("reset-timer");
  if (!el) return;

  const tick = () => {
    el.textContent = `Resets in ${formatHMS(msToNextUtcMidnight())} (UTC)`;
  };

  tick();
  setInterval(tick, 1000);
}

// ---- LOAD JSON ----
async function loadSets() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error("Failed loading sets JSON");
  setsData = await res.json();
}

// ---- RENDER QUESTIONS (MATCH HTML) ----
function renderQuestions() {
  const box = document.getElementById("brain-questions");
  const btn = document.getElementById("submit-level-btn");
  const summary = document.getElementById("level-summary");

  if (!box) return;

  const today = todayKey();
  const day = setsData[today];

  if (!day || !day.easy || day.easy.length === 0) {
    box.innerHTML = `<p>No Easy questions for today.</p>`;
    btn.disabled = true;
    if (summary) summary.textContent = "Easy is not available today.";
    return;
  }

  btn.disabled = false;
  box.innerHTML = "";

  day.easy.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "brain-question";
    div.innerHTML = `
      <div class="brain-question-header">
        <span class="brain-question-title">${q.q}</span>
        <span class="brain-question-index">#${idx + 1}</span>
      </div>
      <input class="brain-input" data-idx="${idx}" placeholder="Your answer" />
      <div class="brain-hint" data-hint-btn="${idx}">💡 Show hint</div>
      <div class="brain-hint-text hidden" data-hint-text="${idx}">
        ${q.hint || ""}
      </div>
    `;
    box.appendChild(div);
  });

  // hint toggle
  box.querySelectorAll("[data-hint-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = btn.getAttribute("data-hint-btn");
      const el = box.querySelector(`[data-hint-text="${idx}"]`);
      el.classList.toggle("hidden");
    });
  });

  if (summary) summary.textContent = "You haven’t submitted Easy yet today.";
}

// ---- SCORE + STREAK ----
function renderLocalStats() {
  const bestBody = document.getElementById("best-days-body");
  const streakSpan = document.getElementById("today-streak");
  const todayScoreEl = document.getElementById("today-score");

  if (!state.best) state.best = {};
  const entries = Object.entries(state.best).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  bestBody.innerHTML = "";

  if (entries.length === 0) {
    bestBody.innerHTML = `<tr><td colspan="2">No results yet.</td></tr>`;
  } else {
    entries.forEach(([date, score]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${date}</td><td>${score}</td>`;
      bestBody.appendChild(tr);
    });
  }

  if (!state.streak) state.streak = 0;
  streakSpan.textContent = state.streak;

  const today = todayKey();
  todayScoreEl.textContent = state.best[today] || 0;
}

// ---- UPDATE STREAK ----
function updateStreak(score) {
  const today = todayKey();

  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);

  if (!state.streak) state.streak = 0;
  if (!state.lastDate) state.lastDate = null;

  if (score > 0) {
    if (state.lastDate === yesterday) {
      state.streak += 1;
    } else if (state.lastDate !== today) {
      state.streak = 1;
    }
    state.lastDate = today;
  }
}

// ---- SUBMIT ----
async function submitEasy() {
  const today = todayKey();
  const day = setsData[today];
  if (!day || !day.easy) return;

  const inputs = Array.from(
    document.querySelectorAll("[data-idx]")
  );

  let score = 0;

  inputs.forEach((input) => {
    const idx = Number(input.getAttribute("data-idx"));
    const user = input.value.trim().toLowerCase();
    const correct = day.easy[idx].a.trim().toLowerCase();
    if (user && user === correct) score++;
  });

  // save locally
  state.best[today] = score;
  updateStreak(score);
  saveState();
  renderLocalStats();

  // global submit
  const name = document.getElementById("global-name-input").value || "Player";

  try {
    await fetch("/api/brain-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score, date: today }),
    });
  } catch (err) {
    console.error("Submit failed", err);
  }

  loadLeaderboard();
  alert(`Your score: ${score}/5`);
}

// ---- GLOBAL LEADERBOARD ----
async function loadLeaderboard() {
  const body = document.getElementById("global-leaderboard-body");
  body.innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;

  try {
    const res = await fetch("/api/brain-leaderboard");
    const data = await res.json();

    if (!data.ok) {
      body.innerHTML = `<tr><td colspan="4">Error loading leaderboard.</td></tr>`;
      return;
    }

    const rows = data.rows || [];
    if (rows.length === 0) {
      body.innerHTML = `<tr><td colspan="4">No scores yet.</td></tr>`;
      return;
    }

    body.innerHTML = "";
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.name}</td>
        <td>${r.score}</td>
        <td>${r.date}</td>
      `;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="4">Error.</td></tr>`;
  }
}

// ---- INIT ----
async function initBrain() {
  startResetTimer();
  renderLocalStats();

  await loadSets();
  renderQuestions();

  loadLeaderboard();

  const submit = document.getElementById("submit-level-btn");
  if (submit) submit.addEventListener("click", submitEasy);

  console.log("Daily Brain Initialized");
}

document.addEventListener("DOMContentLoaded", initBrain);
