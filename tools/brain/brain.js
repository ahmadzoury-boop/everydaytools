// ================================
// EverydayTools.uk — Daily Brain
// Sequential Questions + Enter Key + Dark/Light Mode
// SAFE DOM VERSION
// ================================

const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_seq_v1";

// --- Helpers ---
const todayKey = () => new Date().toISOString().slice(0, 10);
const norm = (s) => String(s ?? "").trim().toLowerCase();

// --- State ---
let brainDB = null;
let currentLevel = "easy";
let questions = [];
let index = 0;
let correct = 0;
let finished = false;
let currentInput = null;

// --- DOM (resolved later safely) ---
let qWrap, submitBtn, levelBtns, todayScoreEl, levelSummaryEl, themeToggle;

// ================================
// DOM READY
// ================================
document.addEventListener("DOMContentLoaded", () => {
  qWrap = document.getElementById("questions");
  submitBtn = document.getElementById("submitBtn");
  levelBtns = document.querySelectorAll("[data-level]");
  todayScoreEl = document.getElementById("todayScore");
  levelSummaryEl = document.getElementById("level-summary");
  themeToggle = document.getElementById("theme-toggle");

  applyTheme(loadTheme());
  setupThemeToggle();
  setupEvents();
  loadData();
});

// ================================
// DATA
// ================================
function loadData() {
  fetch(DATA_URL)
    .then((r) => r.json())
    .then((data) => {
      brainDB = data;
      initLevel("easy");
    })
    .catch(() => {
      if (qWrap) {
        qWrap.innerHTML =
          "<p class='brain-help-text'>Failed to load questions.</p>";
      }
    });
}

// ================================
// LEVEL INIT
// ================================
function initLevel(level) {
  currentLevel = level;
  index = 0;
  correct = 0;
  finished = false;

  const today = todayKey();
  questions = brainDB?.[today]?.[level] || [];

  if (!questions.length) {
    qWrap.innerHTML =
      "<p class='brain-help-text'>No questions available for today.</p>";
    return;
  }

  showQuestion();
  updateSummary();
}

// ================================
// QUESTION RENDER
// ================================
function showQuestion() {
  const q = questions[index];

  qWrap.innerHTML = `
    <div class="brain-question-card">
      <div class="q-text">${index + 1}. ${q.q}</div>
      <input id="answerInput" autocomplete="off" placeholder="Your answer…" />
      <div class="brain-hint">💡 Show hint</div>
      <div class="brain-hint-box hidden">${q.hint || ""}</div>
    </div>
  `;

  currentInput = document.getElementById("answerInput");
  const hintBtn = qWrap.querySelector(".brain-hint");
  const hintBox = qWrap.querySelector(".brain-hint-box");

  currentInput.focus();

  hintBtn.addEventListener("click", () => {
    hintBox.classList.toggle("hidden");
  });
}

// ================================
// SUBMIT LOGIC
// ================================
function submitAnswer() {
  if (finished || !currentInput) return;

  const user = norm(currentInput.value);
  const solution = norm(questions[index].a);

  if (user === solution) correct++;

  index++;

  if (index < questions.length) {
    showQuestion();
  } else {
    finished = true;
    finishLevel();
  }

  updateSummary();
}

// ================================
// FINISH
// ================================
function finishLevel() {
  qWrap.innerHTML = `
    <p class="brain-help-text">
      You finished this level!<br>
      <strong>Score: ${correct}/${questions.length}</strong>
    </p>
  `;

  if (todayScoreEl) {
    todayScoreEl.textContent = `${correct}/${questions.length}`;
  }
}

// ================================
// SUMMARY
// ================================
function updateSummary() {
  if (!levelSummaryEl) return;

  levelSummaryEl.innerHTML = finished
    ? `Finished! Score: ${correct}/${questions.length}`
    : `Question ${index + 1} of ${questions.length}`;
}

// ================================
// EVENTS (SAFE)
// ================================
function setupEvents() {
  // Submit button
  if (submitBtn) {
    submitBtn.addEventListener("click", submitAnswer);
  }

  // Enter key
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (!currentInput) return;
    if (document.activeElement === currentInput) submitAnswer();
  });

  // Level buttons
  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      levelBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      initLevel(btn.dataset.level);
    });
  });
}

// ================================
// THEME
// ================================
function loadTheme() {
  return localStorage.getItem("brainTheme") || "dark";
}

function applyTheme(mode) {
  if (mode === "light") {
    document.documentElement.style.colorScheme = "light";
    document.body.classList.add("light-mode");
  } else {
    document.documentElement.style.colorScheme = "dark";
    document.body.classList.remove("light-mode");
  }
  localStorage.setItem("brainTheme", mode);
}

function setupThemeToggle() {
  if (!themeToggle) {
    themeToggle = document.createElement("button");
    themeToggle.id = "theme-toggle";
    themeToggle.textContent = "🌓";
    themeToggle.style.cssText =
      "position:fixed;bottom:20px;right:20px;border-radius:999px;padding:10px 14px;background:#3b82f6;color:white;border:none;cursor:pointer;z-index:9999;";
    document.body.appendChild(themeToggle);
  }

  themeToggle.addEventListener("click", () => {
    const next = loadTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}
