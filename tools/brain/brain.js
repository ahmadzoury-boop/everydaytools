// ================================
// Daily Brain — EverydayTools.uk
// Final JS matched to current HTML
// ================================

// ---- Config ----
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";

// ---- State ----
let setsData = null;
let localStore = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");

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

function saveLocalStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(localStore));
}

// ---- Reset timer ----
function startResetCountdown() {
  const el = document.getElementById("resetTimer");
  if (!el) return;
  const tick = () => {
    el.textContent = `Resets in ${fmtHMS(msToNextUtcMidnight())} (UTC)`;
  };
  tick();
  setInterval(tick, 1000);
}

// ---- Load sets JSON ----
async function loadSets() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error("Failed to load sets JSON");
  setsData = await res.json();
}

// ---- Render questions (Easy only for now) ----
function renderQuestions() {
  const box = document.getElementById("questionsBox");
  const submitBtn = document.getElementById("submitBtn");
  const summaryEl = document.getElementById("level-summary");
  if (!box) return;

  if (!setsData) {
    box.innerHTML = "<p>Loading today’s puzzle…</p>";
    submitBtn && (submitBtn.disabled = true);
    return;
  }

  const today = todayKey();
  const dayBlock = setsData[today];

  if (!dayBlock || !dayBlock.easy || !dayBlock.easy.length) {
    box.innerHTML =
      "<p>No Easy questions available for today yet. Please check back later.</p>";
    if (submitBtn) submitBtn.disabled = true;
    if (summaryEl) {
      summaryEl.textContent =
        "No Easy puzzle available for today. Come back tomorrow!";
    }
    return;
  }

  if (submitBtn) submitBtn.disabled = false;

  box.innerHTML = "";
  dayBlock.easy.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "brain-question-card";
    card.innerHTML = `
      <div class="brain-question-text">${q.q}</div>
      <input type="text" data-idx="${idx}" placeholder="Your answer" />
      <div class="brain-hint" data-hint-btn="${idx}">💡 Show hint</div>
      <div class="brain-hint-box hidden" data-hint-text="${idx}">
        ${q.hint || "Think about it…"}
      </div>
    `;
    box.appendChild(card);
  });

  // hint toggles
  box.querySelectorAll("[data-hint-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = btn.getAttribute("data-hint-btn");
      const hintBox = box.querySelector(`[data-hint-text="${idx}"]`);
      if (hintBox) hintBox.classList.toggle("hidden");
    });
  });

  if (summaryEl) {
    summaryEl.textContent = "You haven’t submitted Easy yet today.";
  }
}

// ---- Streak + Best days ----
function computeAndRenderBestDays() {
  const bestDiv = document.getElementById("bestDays");
  const streakBox = document.getElementById("streakBox");
  const todayScoreEl = document.getElementById("today-score");
  if (!bestDiv) return;

  if (!localStore.best) localStore.best = {};
  const entries = Object.entries(localStore.best).sort(([d1], [d2]) =>
    d1.localeCompare(d2)
  );

  if (!entries.length) {
    bestDiv.textContent = "No results yet. Play to start your streak!";
  } else {
    bestDiv.innerHTML = "";
    entries.forEach(([date, score]) => {
      const row = document.createElement("div");
      row.textContent = `${date} — ${score}/5`;
      bestDiv.appendChild(row);
    });
  }

  // streak
  if (!localStore.streak) localStore.streak = 0;
  if (!localStore.lastDate) localStore.lastDate = null;
  if (streakBox) {
    streakBox.textContent = `🔥 Streak: ${localStore.streak}`;
  }

  // today's score (if any)
  const today = todayKey();
  if (todayScoreEl) {
    todayScoreEl.textContent = localStore.best[today] || 0;
  }
}

// ---- Update streak after a score ----
function updateStreakForToday(score) {
  const today = todayKey();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);

  if (!localStore.streak) localStore.streak = 0;
  if (!localStore.lastDate) localStore.lastDate = null;

  if (score > 0) {
    if (localStore.lastDate === today) {
      // same day: keep streak as-is
    } else if (localStore.lastDate === yesterday) {
      localStore.streak += 1;
    } else {
      localStore.streak = 1;
    }
    localStore.lastDate = today;
  }
}

// ---- Submit Easy ----
async function handleSubmitEasy() {
  if (!setsData) return;

  const today = todayKey();
  const dayBlock = setsData[today];
  if (!dayBlock || !dayBlock.easy) return;

  const questions = dayBlock.easy;
  const inputs = Array.from(
    document.querySelectorAll("#questionsBox input[data-idx]")
  );

  let score = 0;
  inputs.forEach((input) => {
    const idx = Number(input.getAttribute("data-idx"));
    const user = (input.value || "").trim().toLowerCase();
    const correct = (questions[idx].a || "").trim().toLowerCase();
    if (user && correct && user === correct) score++;
  });

  // save locally
  if (!localStore.best) localStore.best = {};
  localStore.best[today] = score;
  updateStreakForToday(score);
  saveLocalStore();
  computeAndRenderBestDays();

  // show in today's result
  const todayScoreEl = document.getElementById("today-score");
  const streakBox = document.getElementById("streakBox");
  if (todayScoreEl) todayScoreEl.textContent = score;
  if (streakBox) streakBox.textContent = `🔥 Streak: ${localStore.streak}`;

  // submit to global leaderboard
  const nameInput = document.getElementById("playerName");
  const playerName = (nameInput?.value || "Player").trim().slice(0, 40);

  try {
    await fetch("/api/brain-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName || "Player", score, date: today }),
    });
  } catch (e) {
    console.error("Submit error", e);
  }

  // reload global leaderboard
  loadGlobalLeaderboard();

  alert(`Your Easy score today: ${score}/${questions.length}`);
}

// ---- Global Leaderboard ----
async function loadGlobalLeaderboard() {
  const box = document.getElementById("globalLeaderboard");
  if (!box) return;

  box.textContent = "Loading…";

  try {
    const res = await fetch("/api/brain-leaderboard");
    const data = await res.json();
    if (!data.ok) {
      box.textContent = "Error loading leaderboard.";
      return;
    }

    const rows = data.rows || [];
    if (!rows.length) {
      box.textContent = "No global scores yet.";
      return;
    }

    box.innerHTML = "";
    rows.forEach((row, i) => {
      const div = document.createElement("div");
      div.textContent = `${i + 1}. ${row.name} — ${row.score} (${row.date})`;
      box.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    box.textContent = "Error loading leaderboard.";
  }
}

// ---- Init ----
async function initBrain() {
  try {
    startResetCountdown();

    // load local state (best days + streak)
    computeAndRenderBestDays();

    // load question sets
    await loadSets();
    renderQuestions();

    // load leaderboard
    loadGlobalLeaderboard();

    // wire submit
    const btn = document.getElementById("submitBtn");
    if (btn) {
      btn.addEventListener("click", handleSubmitEasy);
    }

    console.log("Daily Brain initialized");
  } catch (err) {
    console.error("Init error", err);
  }
}

document.addEventListener("DOMContentLoaded", initBrain);
