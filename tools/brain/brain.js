// ================================
// EverydayTools.uk — Daily Brain
// FINAL FULL VERSION 2026
// ================================

// --------------------------------
// CONFIG
// --------------------------------
const DATA_URL = "/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";

// --------------------------------
// HELPERS
// --------------------------------
function todayKey() {
  // LOCAL date (not UTC!) to match JSON keys exactly
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const norm = (s) => String(s ?? "").trim().toLowerCase();

// --------------------------------
// STATE
// --------------------------------
let brainDB = null;
let currentLevel = "easy";
let questions = [];
let index = 0;
let correct = 0;
let finished = false;
let currentInput = null;
let attempts = 0;   // tracking wrong tries
const MAX_ATTEMPTS = 3;

// --------------------------------
// DOM ELEMENTS
// --------------------------------
let qWrap,
  submitBtn,
  levelBtns,
  todayScoreEl,
  levelSummaryEl,
  themeToggle;

// --------------------------------
// INIT DOM
// --------------------------------
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

// --------------------------------
// LOAD JSON
// --------------------------------
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

// --------------------------------
// INIT LEVEL
// --------------------------------
function initLevel(level) {
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

// --------------------------------
// RENDER QUESTION
// --------------------------------
function showQuestion() {
  const q = questions[index];
  attempts = 0;

  qWrap.innerHTML = `
    <div class="brain-question-card">
      <div class="q-text">${index + 1}. ${q.q}</div>

      <input id="answerInput" autocomplete="off" placeholder="Your answer…" />

      <div class="brain-hint">💡 Show hint</div>
      <div class="brain-hint-box hidden">${q.hint || ""}</div>

      <p id="attempt-msg" class="brain-help-text" style="color:#f87171;margin-top:6px;"></p>

      <button id="skipBtn" class="brain-button-secondary" style="margin-top:10px;display:none;">Skip Question</button>
    </div>
  `;

  currentInput = document.getElementById("answerInput");
  if (currentInput) currentInput.focus();

  const hintBtn = qWrap.querySelector(".brain-hint");
  const hintBox = qWrap.querySelector(".brain-hint-box");
  const skipBtn = document.getElementById("skipBtn");

  if (hintBtn)
    hintBtn.addEventListener("click", () => hintBox.classList.toggle("hidden"));

  if (skipBtn)
    skipBtn.addEventListener("click", () => {
      index++;
      if (index < questions.length) {
        showQuestion();
        updateSummary();
      } else {
        finishLevel();
      }
    });
}

// --------------------------------
// SUBMIT LOGIC (WITH ATTEMPTS)
// --------------------------------
function submitAnswer() {
  if (finished || !currentInput) return;

  const attemptMsg = document.getElementById("attempt-msg");
  const user = norm(currentInput.value);
  const solution = norm(questions[index].a);

  // Correct
  if (user === solution) {
    correct++;
    index++;
    if (index < questions.length) {
      showQuestion();
    } else {
      finishLevel();
    }
    updateSummary();
    return;
  }

  // Wrong answer
  attempts++;

  if (attempts < MAX_ATTEMPTS) {
    attemptMsg.textContent = `Wrong answer. Attempts left: ${MAX_ATTEMPTS - attempts}`;
    return;
  }

  // Out of attempts — show skip option
  attemptMsg.textContent = `No attempts left. You can skip this question.`;
  document.getElementById("skipBtn").style.display = "block";
}

// --------------------------------
// FINISH LEVEL
// --------------------------------
function finishLevel() {
  finished = true;

  qWrap.innerHTML = `
    <p class="brain-help-text">
      You finished this level 🎉<br>
      <strong>Score: ${correct}/${questions.length}</strong>
    </p>
  `;

  todayScoreEl.textContent = `${correct}/${questions.length}`;

  // Unlock next level
  unlockNextLevel(currentLevel);
}

// --------------------------------
// UNLOCK NEXT LEVEL
// --------------------------------
function unlockNextLevel(level) {
  const order = ["easy", "medium", "hard"];
  const idx = order.indexOf(level);
  if (idx === -1 || idx === order.length - 1) return;

  const next = order[idx + 1];
  const btn = document.querySelector(`[data-level="${next}"]`);
  if (btn) btn.classList.remove("locked");
}

// --------------------------------
// SUMMARY
// --------------------------------
function updateSummary() {
  if (!levelSummaryEl) return;

  if (finished) {
    levelSummaryEl.innerHTML = `Finished · Score ${correct}/${questions.length}`;
  } else {
    levelSummaryEl.innerHTML = `Question ${index + 1} of ${questions.length}`;
  }
}

// --------------------------------
// EVENTS
// --------------------------------
function setupEvents() {
  if (submitBtn) submitBtn.addEventListener("click", submitAnswer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && currentInput === document.activeElement) {
      submitAnswer();
    }
  });

  levelBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.classList.contains("locked")) return;

      levelBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      initLevel(btn.dataset.level);
    })
  );
}

// --------------------------------
// THEME
// --------------------------------
function loadTheme() {
  return localStorage.getItem("brainTheme") || "dark";
}

function applyTheme(mode) {
  document.documentElement.style.colorScheme = mode;
  if (mode === "light") document.body.classList.add("light-mode");
  else document.body.classList.remove("light-mode");

  localStorage.setItem("brainTheme", mode);
}

function setupThemeToggle() {
  if (!themeToggle) {
    themeToggle = document.createElement("button");
    themeToggle.id = "theme-toggle";
    themeToggle.textContent = "🌓";
    themeToggle.className = "theme-toggle-btn";
    document.body.appendChild(themeToggle);
  }

  themeToggle.addEventListener("click", () => {
    const next = loadTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

// --------------------------------
// SUBSCRIPTION MODULE
// --------------------------------
(() => {
  const btn = document.getElementById("sub-btn");
  const input = document.getElementById("sub-email");
  const msg = document.getElementById("sub-msg");

  if (!btn || !input || !msg) return;

  btn.addEventListener("click", async () => {
    const email = input.value.trim();
    if (!email) {
      msg.textContent = "Please enter your email.";
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
      msg.textContent = "Subscription failed. Try later.";
    }
  });
})();
