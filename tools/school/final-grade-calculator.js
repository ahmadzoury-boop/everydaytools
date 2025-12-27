(() => {
  const LS_KEY = "final_grade_calc_v1";

  const currentEl = document.getElementById("current");
  const weightEl  = document.getElementById("weight");
  const targetEl  = document.getElementById("target");
  const roundingEl = document.getElementById("rounding");

  const calcBtn = document.getElementById("calcBtn");
  const swapBtn = document.getElementById("swapBtn");
  const resetBtn = document.getElementById("resetBtn");
  const copyBtn = document.getElementById("copyBtn");

  const needText = document.getElementById("needText");
  const statusPill = document.getElementById("statusPill");
  const formulaPill = document.getElementById("formulaPill");
  const noteText = document.getElementById("noteText");

  function clampNum(v, min, max) {
    v = Number(v);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  function save() {
    const data = {
      current: currentEl.value,
      weight: weightEl.value,
      target: targetEl.value,
      rounding: roundingEl.value
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;
      if (d.current != null) currentEl.value = d.current;
      if (d.weight != null) weightEl.value = d.weight;
      if (d.target != null) targetEl.value = d.target;
      if (d.rounding != null) roundingEl.value = d.rounding;
    } catch {}
  }

  function fmt(n, decimals) {
    const d = Number(decimals);
    return Number.isFinite(n) ? n.toFixed(d) : "—";
  }

  function calc() {
    save();

    const decimals = clampNum(roundingEl.value, 0, 6);

    const current = clampNum(currentEl.value, -1000, 1000);
    const target = clampNum(targetEl.value, -1000, 1000);
    const wPct = clampNum(weightEl.value, 0, 100);

    const w = wPct / 100;
    const cw = 1 - w;

    formulaPill.textContent = `Formula: (Target − Current×${fmt(cw,2)}) / ${fmt(w,2)}`;

    if (wPct === 0) {
      needText.textContent = `You need: N/A`;
      statusPill.textContent = `Status: Final weight is 0%`;
      statusPill.classList.remove("warn","err");
      statusPill.classList.add("warn");
      noteText.textContent = "Your final exam has 0% weight, so it won’t change your grade.";
      return;
    }

    // Required final score
    const required = (target - (current * cw)) / w;

    // Output
    needText.textContent = `You need: ${fmt(required, decimals)}% on the final`;

    statusPill.classList.remove("warn","err");

    if (required <= 0) {
      statusPill.textContent = "Status: Already secured ✅";
      noteText.textContent = "Even a 0% on the final would still meet your target (mathematically).";
    } else if (required > 100) {
      statusPill.textContent = "Status: Not possible (over 100%)";
      statusPill.classList.add("err");
      noteText.textContent = "To reach the target, you’d need more than 100%. Consider lowering the target or checking the grading weights.";
    } else if (required >= 90) {
      statusPill.textContent = "Status: Very difficult";
      statusPill.classList.add("warn");
      noteText.textContent = "High required score. Double-check weights and consider what’s realistic.";
    } else {
      statusPill.textContent = "Status: Possible ✅";
      noteText.textContent = "Looks achievable. Good luck!";
    }
  }

  function swap() {
    const a = currentEl.value;
    currentEl.value = targetEl.value;
    targetEl.value = a;
    calc();
  }

  function reset() {
    currentEl.value = "82";
    weightEl.value = "30";
    targetEl.value = "85";
    roundingEl.value = "2";

    needText.textContent = "You need: —";
    statusPill.textContent = "Status: —";
    statusPill.classList.remove("warn","err");
    formulaPill.textContent = "Formula: —";
    noteText.textContent = "";

    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  // Events
  [currentEl, weightEl, targetEl, roundingEl].forEach(el => {
    el.addEventListener("input", () => save());
    el.addEventListener("change", () => calc());
  });

  calcBtn.addEventListener("click", calc);
  swapBtn.addEventListener("click", swap);
  resetBtn.addEventListener("click", reset);

  copyBtn.addEventListener("click", async () => {
    const text = needText.textContent.trim();
    if (!text || text.endsWith("—")) return;
    await copy(text + "\n" + statusPill.textContent);
  });

  // Shortcuts (ignore typing in inputs)
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Enter") { e.preventDefault(); calc(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); reset(); }
  });

  // Init
  load();
  calc();
})();
