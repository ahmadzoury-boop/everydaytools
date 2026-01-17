// ================================
// EverydayTools.uk — Daily Brain
// Sequential Questions + Enter Key + Dark/Light Mode
// ================================

const DATA_URL = "/tools/brain/data/sets-2026-01-12_to-2026-02-10.json";
const STORE_KEY = "et_brain_seq_v1";

// --- DOM ---
const qWrap = document.getElementById("questions");
const submitBtn = document.getElementById("submitBtn");
const levelBtns = document.querySelectorAll("[data-level]");
const todayScoreEl = document.getElementById("todayScore");
const levelSummaryEl = document.getElementById("level-summary");

// Theme toggle
let themeToggle = document.getElementById("theme-toggle");

// --- Helpers ---
const todayKey = () => new Date().toISOString().slice(0, 10);

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

// --- State ---
let currentLevel = "easy";
let questions = [];
let index = 0;
let correct = 0;
let finished = false;
let currentInput = null;

// --- THEME ---
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

function toggleTheme() {
  const next = loadTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
}

// --- Load JSON ---
fetch(DATA_URL)
  .then((r) => r.json())
  .then((data) => {
    window.brainDB = data;
    initLevel("easy");
  })
  .catch(() => {
    qWrap.innerHTML = "<p class='brain-help-text'>Failed to load questions.</p>";
  });

// --- Level Init ---
function initLevel(level) {
  currentLevel = level;
  index = 0;
  correct = 0;
  finished = false;

  const today = todayKey();
  questions = brainDB?.[today]?.[level];

  if (!questions || !questions.length) {
    qWrap.innerHTML = "<p class='brain-help-text'>No questions available.</p>";
    return;
  }

  showQuestion(index);
  updateSummary();
}

// --- Show 1 Question ---
function showQuestion(i) {
  const q = questions[i];
  qWrap.innerHTML = `
    <div class="brain-question-card">
      <div class="q-text">${i + 1}. ${q.q}</div>
      <input id="answerInput" autocomplete="off" placeholder="Your answer…" />
      <div class="brain-hint" data-hint="${i}">💡 Show hint</div>
      <div class="brain-hint-box hidden" id="hint-${i}">${q.hint}</div>
    </div>
  `;

  currentInput = document.getElementById("answerInput");
  currentInput.focus();

  // hint reveal
  qWrap.querySelector(".brain-hint").addEventListener("click", () => {
    document.getElementById(`hint-${i}`).classList.toggle("hidden");
  });
}

// --- Submit ---
function submitAnswer() {
  if (finished) return;

  const user = norm(currentInput.value);
  const solution = norm(questions[index].a);

  if (user === solution) correct++;

  index++;

  if (index < questions.length) {
    showQuestion(index);
  } else {
    finished = true;
    finishLevel();
  }

  updateSummary();
}

// --- Enter Key Support ---
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && currentInput === document.activeElement) {
    submitAnswer();
  }
});

// --- Button Submit ---
submitBtn.addEventListener("click", submitAnswer);

// --- Finish Level ---
function finishLevel() {
  qWrap.innerHTML = `
    <p class="brain-help-text">
      You finished this level!  
      Score: <strong>${correct}/${questions.length}</strong>
    </p>
  `;

  todayScoreEl.innerText = `${correct}/${questions.length}`;
}

// --- Summary Text ---
function updateSummary() {
  if (finished) {
    levelSummaryEl.innerHTML = `Finished! Score: ${correct}/${questions.length}`;
  } else {
    levelSummaryEl.innerHTML = `Question ${index + 1} of ${questions.length}`;
  }
}

// --- Level Switch ---
levelBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("locked")) return;

    levelBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    initLevel(btn.dataset.level);
  });
});

// --- Apply Saved Theme ---
applyTheme(loadTheme());

// --- Setup theme toggle ---
if (!themeToggle) {
  const t = document.createElement("button");
  t.id = "theme-toggle";
  t.textContent = "🌓 Theme";
  t.style.cssText =
    "position:fixed;bottom:20px;right:20px;border-radius:999px;padding:10px 16px;background:#3b82f6;color:white;border:none;cursor:pointer;z-index:9999;";
  document.body.appendChild(t);
  themeToggle = t;
}
themeToggle.addEventListener("click", toggleTheme);
