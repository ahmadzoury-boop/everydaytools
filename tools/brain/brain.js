// ================================
// EverydayTools.uk — Daily Brain
// FINAL STABLE brain.js
// ================================

// ---- Config ----
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";

// ---- State ----
let setsData = null;
let currentLevel = "easy";
let answers = {};
let scoreToday = 0;

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
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

// ---- DOM ----
const qWrap = document.getElementById("questions");
const submitBtn = document.getElementById("submitBtn");
const levelBtns = document.querySelectorAll("[data-level]");
const resultScore = document.getElementById("todayScore");

// ---- Timer ----
const timerEl = document.getElementById("resetTimer");
if (timerEl) {
  const tick = () => (timerEl.textContent = fmtHMS(msToNextUtcMidnight()));
  tick();
  setInterval(tick, 1000);
}

// ---- Load Data ----
fetch(DATA_URL)
  .then((r) => r.json())
  .then((data) => {
    setsData = data;
    loadLevel("easy");
  })
  .catch((err) => {
    console.error("Failed to load brain data", err);
    qWrap.innerHTML =
      "<p class='muted'>Failed to load today’s questions.</p>";
  });

// ---- Load Level ----
function loadLevel(level) {
  currentLevel = level;
  answers = {};
  scoreToday = 0;

  qWrap.innerHTML = "";

  const today = todayKey();
  const daySet = setsData?.[today];

  if (!daySet || !daySet[level] || !daySet[level].length) {
    qWrap.innerHTML =
      "<p class='muted'>No questions available for today.</p>";
    return;
  }

  daySet[level].forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question-card";

    div.innerHTML = `
      <div class="q-text">${i + 1}. ${q.q}</div>
      <input type="text" data-i="${i}" placeholder="Your answer" />
      <button class="hint-btn" data-i="${i}">💡 Hint</button>
      <div class="hint hidden" id="hint-${i}">${q.hint}</div>
    `;

    qWrap.appendChild(div);
  });

  bindInputs();
}

// ---- Inputs & Hints ----
function bindInputs() {
  qWrap.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      answers[e.target.dataset.i] = e.target.value.trim().toLowerCase();
    });
  });

  qWrap.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .getElementById(`hint-${btn.dataset.i}`)
        .classList.toggle("hidden");
    });
  });
}

// ---- Submit ----
if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    const today = todayKey();
    const questions = setsData[today][currentLevel];

    scoreToday = 0;

    questions.forEach((q, i) => {
      if (
        answers[i] !== undefined &&
        answers[i] === String(q.a).toLowerCase()
      ) {
        scoreToday++;
      }
    });

    if (resultScore) {
      resultScore.textContent = `${scoreToday}/${questions.length}`;
    }
  });
}

// ---- Level Switch ----
levelBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    levelBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    loadLevel(btn.dataset.level);
  });
});
