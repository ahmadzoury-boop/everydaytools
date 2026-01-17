// ================================
// EverydayTools.uk — Daily Brain
// FINAL DOM-SAFE brain.js
// ================================

// ---- Config ----
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";

// ---- State ----
let setsData = null;
let currentLevel = "easy";
let answers = {};
let scoreToday = 0;

// ---- Helpers ----
const todayKey = () => new Date().toISOString().slice(0, 10);

// ---- DOM (SAFE SELECTORS) ----
const qWrap =
  document.querySelector("#questions") ||
  document.querySelector(".questions") ||
  document.querySelector("[data-questions]");

const submitBtn =
  document.querySelector("#submitBtn") ||
  document.querySelector(".submit-btn") ||
  document.querySelector("[data-submit]");

const levelBtns = document.querySelectorAll("[data-level]");
const resultScore =
  document.querySelector("#todayScore") ||
  document.querySelector("[data-score]");

if (!qWrap) {
  console.error("❌ Questions container not found in DOM");
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
    if (qWrap) {
      qWrap.innerHTML =
        "<p class='muted'>Failed to load questions.</p>";
    }
  });

// ---- Load Level ----
function loadLevel(level) {
  currentLevel = level;
  answers = {};
  scoreToday = 0;

  if (!qWrap) return;
  qWrap.innerHTML = "";

  const today = todayKey();
  const daySet = setsData?.[today];

  if (!daySet || !daySet[level]) {
    qWrap.innerHTML =
      "<p class='muted'>No questions available today.</p>";
    return;
  }

  daySet[level].forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question-card";

    div.innerHTML = `
      <div class="q-text">${i + 1}. ${q.q}</div>
      <input type="text" data-i="${i}" placeholder="Your answer" />
      <button class="hint-btn" type="button" data-i="${i}">💡 Hint</button>
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
      answers[e.target.dataset.i] = e.target.value
        .trim()
        .toLowerCase();
    });
  });

  qWrap.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .getElementById(`hint-${btn.dataset.i}`)
        ?.classList.toggle("hidden");
    });
  });
}

// ---- Submit ----
if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    const today = todayKey();
    const questions = setsData?.[today]?.[currentLevel] || [];

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
