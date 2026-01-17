// ================================
// EverydayTools.uk — Daily Brain
// FINAL COMPLETE VERSION
// - Sequential questions
// - Multiple attempts per question
// - Optional "Next question" skip
// - Level unlocks + streak + history + theme + subscription
// ================================

const DATA_URL = "/tools/brain/data/sets-2026-01-12_to-2026-02-10.json";
const STORAGE_KEY = "et_brain_progress_v1";

// ---------- Helpers ----------
const todayKey = () => new Date().toISOString().slice(0, 10);
const norm = (s) => String(s ?? "").trim().toLowerCase();

// ---------- State ----------
let brainDB = null;
let currentLevel = "easy";
let questions = [];
let index = 0;
let correct = 0;
let finished = false;
let currentInput = null;
let attempts = 0; // attempts on current question

// ---------- Progress (persisted) ----------
let progress = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  unlocked: { easy: true, medium: false, hard: false },
  history: {}, // date -> { level, score }
  streak: 0,
  lastDay: null,
};

// ---------- DOM ----------
let qWrap,
  submitBtn,
  levelBtns,
  todayScoreEl,
  levelSummaryEl,
  bestDaysEl,
  streakEl,
  themeToggle;

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  qWrap = document.getElementById("questions");
  submitBtn = document.getElementById("submitBtn");
  levelBtns = document.querySelectorAll("[data-level]");
  todayScoreEl = document.getElementById("todayScore");
  levelSummaryEl = document.getElementById("level-summary");
  bestDaysEl = document.getElementById("bestDays");
  streakEl = document.getElementById("streakBox");
  themeToggle = document.getElementById("theme-toggle");

  applyTheme(loadTheme());
  setupThemeToggle();
  setupEvents();
  loadData();
  applyUnlocks();
  renderHistory();
  renderStreak();
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
      qWrap.innerHTML =
        "<p class='brain-help-text'>Today’s challenge is preparing…</p>";
    });
}

// ================================
// LEVEL UNLOCK
// ================================
function applyUnlocks() {
  levelBtns.forEach((btn) => {
    const lvl = btn.dataset.level;
    if (!progress.unlocked[lvl]) {
      btn.classList.add("locked");
      btn.style.opacity = ".5";
    } else {
      btn.classList.remove("locked");
      btn.style.opacity = "1";
    }
  });
}

function unlockNext(level) {
  if (level === "easy") progress.unlocked.medium = true;
  if (level === "medium") progress.unlocked.hard = true;
  saveProgress();
  applyUnlocks();
}

// ================================
// LEVEL INIT
// ================================
function initLevel(level) {
  if (submitBtn) submitBtn.style.display = "inline-block";

  currentLevel = level;
  index = 0;
  correct = 0;
  finished = false;
  attempts = 0;

  const today = todayKey();
  questions = brainDB?.[today]?.[level] || [];

  if (!questions.length) {
    qWrap.innerHTML =
      "<p class='brain-help-text'>No questions available today.</p>";
    updateSummary();
    return;
  }

  showQuestion();
  updateSummary();
}

// ================================
// QUESTION
// ================================
function showQuestion() {
  const q = questions[index];
  attempts = 0;

  qWrap.innerHTML = `
    <div class="brain-question-card">
      <div class="q-text">${index + 1}. ${q.q}</div>
      <input id="answerInput" placeholder="Your answer…" />
      <div class="brain-hint">💡 Show hint</div>
      <div class="brain-hint-box hidden">${q.hint || ""}</div>
      <div id="feedback" class="brain-help-text" style="margin-top:6px;"></div>
      <button id="nextQuestionBtn"
              class="brain-button-primary"
              style="margin-top:10px;display:none;"
              type="button">
        Next question
      </button>
    </div>
  `;

  currentInput = document.getElementById("answerInput");
  if (currentInput) currentInput.focus();

  const hintBtn = qWrap.querySelector(".brain-hint");
  const hintBox = qWrap.querySelector(".brain-hint-box");
  const nextBtn = document.getElementById("nextQuestionBtn");

  if (hintBtn && hintBox) {
    hintBtn.addEventListener("click", () => {
      hintBox.classList.toggle("hidden");
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      goNextQuestion(); // skip even if user never got it correct
    });
  }
}

// Helper to move to next question or finish
function goNextQuestion() {
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
// SUBMIT
// ================================
function submitAnswer() {
  if (finished || !currentInput) return;

  const feedback = document.getElementById("feedback");
  const nextBtn = document.getElementById("nextQuestionBtn");

  const user = norm(currentInput.value);
  const solution = norm(questions[index].a);

  // Empty answer → just nudge
  if (!user) {
    if (feedback) feedback.textContent = "Type an answer first 🙂";
    return;
  }

  attempts++;

  if (user === solution) {
    // Correct – count & move on automatically
    correct++;
    if (feedback) feedback.textContent = "✅ Correct!";
    goNextQuestion();
  } else {
    // Wrong – let them try again, or skip
    if (feedback) {
      feedback.textContent =
        "❌ Not correct. Try again, or click “Next question” to skip.";
    }
    if (nextBtn) nextBtn.style.display = "inline-block";
    // Stay on same question, no index++ here
  }
}

// ================================
// FINISH
// ================================
function finishLevel() {
  qWrap.innerHTML = `
    <p class="brain-help-text">
      You finished ${currentLevel.toUpperCase()} 🎉<br>
      <strong>${correct}/${questions.length}</strong>
    </p>
    <button id="retryBtn" class="brain-button-primary">Try Again</button>
  `;

  if (submitBtn) submitBtn.style.display = "none";
  document.getElementById("retryBtn").onclick = () => initLevel(currentLevel);

  saveTodayResult();
  unlockNext(currentLevel);
  confetti();
  renderHistory();
  renderStreak();
}

// ================================
// SUMMARY
// ================================
function updateSummary() {
  if (!levelSummaryEl) return;

  if (!questions.length) {
    levelSummaryEl.textContent = "No questions today.";
    return;
  }

  levelSummaryEl.textContent = finished
    ? `Finished · Score ${correct}/${questions.length}`
    : `Question ${index + 1} of ${questions.length}`;
}

// ================================
// EVENTS
// ================================
function setupEvents() {
  // Submit button
  if (submitBtn) {
    submitBtn.addEventListener("click", submitAnswer);
  }

  // Enter key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement === currentInput) {
      submitAnswer();
    }
  });

  // Level buttons
  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const lvl = btn.dataset.level;
      if (!progress.unlocked[lvl]) return;

      levelBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      initLevel(lvl);
    });
  });
}

// ================================
// HISTORY + STREAK
// ================================
function saveTodayResult() {
  const today = todayKey();

  progress.history[today] = {
    level: currentLevel,
    score: `${correct}/${questions.length}`,
  };

  if (progress.lastDay !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);

    progress.streak = progress.lastDay === yKey ? progress.streak + 1 : 1;
    progress.lastDay = today;
  }

  saveProgress();
}

function renderHistory() {
  if (!bestDaysEl) return;

  const rows = Object.entries(progress.history)
    .slice(-5)
    .reverse()
    .map(([d, r]) => `<div>${d} — ${r.level} ${r.score}</div>`)
    .join("");

  bestDaysEl.innerHTML = rows || "No history yet.";
}

function renderStreak() {
  if (streakEl) {
    streakEl.textContent = `🔥 Streak: ${progress.streak}`;
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ================================
// CONFETTI
// ================================
function confetti() {
  for (let i = 0; i < 40; i++) {
    const c = document.createElement("div");
    c.style.cssText = `
      position:fixed;
      top:-10px;
      left:${Math.random() * 100}vw;
      width:6px;height:6px;
      background:hsl(${Math.random() * 360},100%,60%);
      animation: brain-fall 1.2s linear forwards;
      z-index:9999;
    `;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1200);
  }
}

const confettiStyle = document.createElement("style");
confettiStyle.textContent = `
@keyframes brain-fall {
  to { transform: translateY(110vh); opacity:0; }
}
`;
document.head.appendChild(confettiStyle);

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

// ================================
// SUBSCRIPTION
// ================================
(() => {
  const btn = document.getElementById("sub-btn");
  const input = document.getElementById("sub-email");
  const msg = document.getElementById("sub-msg");

  if (!btn || !input || !msg) return;

  btn.addEventListener("click", async () => {
    const email = input.value.trim();
    if (!email) {
      msg.textContent = "Enter a valid email.";
      return;
    }

    msg.textContent = "Subscribing…";

    try {
      const r = await fetch("/api/brain-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      msg.textContent = data.message || "Subscribed!";
    } catch {
      msg.textContent = "Please try again later.";
    }
  });
})();
