(() => {
  const LS_KEY = "prop_calc_v1";

  const aEl = document.getElementById("a");
  const bEl = document.getElementById("b");
  const cEl = document.getElementById("c");
  const dEl = document.getElementById("d");

  const roundingEl = document.getElementById("rounding");
  const modeEl = document.getElementById("mode");
  const toleranceEl = document.getElementById("tolerance");

  const calcBtn = document.getElementById("calcBtn");
  const clearBtn = document.getElementById("clearBtn");
  const copyBtn = document.getElementById("copyBtn");

  const resultText = document.getElementById("resultText");
  const checkPill = document.getElementById("checkPill");
  const methodPill = document.getElementById("methodPill");
  const noteText = document.getElementById("noteText");

  function num(v) {
    if (v === "" || v == null) return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function isBlank(v) {
    return String(v ?? "").trim() === "";
  }

  function fmt(n, d) {
    const dec = Number(d);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(dec);
  }

  function save() {
    const data = {
      a: aEl.value, b: bEl.value, c: cEl.value, d: dEl.value,
      rounding: roundingEl.value,
      mode: modeEl.value,
      tol: toleranceEl.value
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;
      if (d.a != null) aEl.value = d.a;
      if (d.b != null) bEl.value = d.b;
      if (d.c != null) cEl.value = d.c;
      if (d.d != null) dEl.value = d.d;
      if (d.rounding != null) roundingEl.value = d.rounding;
      if (d.mode != null) modeEl.value = d.mode;
      if (d.tol != null) toleranceEl.value = d.tol;
    } catch {}
  }

  function checkEquality(a, b, c, d, tol) {
    // Compare a/b and c/d by cross multiplication: a*d ≈ b*c
    const left = a * d;
    const right = b * c;
    const diff = Math.abs(left - right);
    const scale = Math.max(1, Math.abs(left), Math.abs(right));
    return diff <= tol * scale;
  }

  function calc() {
    save();

    const dps = Number(roundingEl.value);
    const tol = Number(toleranceEl.value);

    const A_blank = isBlank(aEl.value);
    const B_blank = isBlank(bEl.value);
    const C_blank = isBlank(cEl.value);
    const D_blank = isBlank(dEl.value);

    const blanks = [
      A_blank ? "a" : null,
      B_blank ? "b" : null,
      C_blank ? "c" : null,
      D_blank ? "d" : null,
    ].filter(Boolean);

    if (blanks.length === 4) {
      resultText.textContent = "Result: Enter at least 3 values";
      checkPill.textContent = "Check: —";
      methodPill.textContent = "Method: —";
      noteText.textContent = "You need 3 known values to solve a proportion.";
      return;
    }

    // determine which variable to solve
    let solveFor = modeEl.value;
    if (solveFor === "auto") solveFor = blanks[0] || "d";

    // Read numeric values (NaN if blank/invalid)
    let a = num(aEl.value), b = num(bEl.value), c = num(cEl.value), d = num(dEl.value);

    // If chosen solveFor isn't blank but there is a blank, we still solve chosen; if chosen is filled, we overwrite it.
    // Need the other 3 to be valid numbers.
    function needValid(...vals) { return vals.every(v => Number.isFinite(v)); }

    let solvedVal = NaN;

    // a/b = c/d  => a*d = b*c
    if (solveFor === "a") {
      if (!needValid(b, c, d) || d === 0) {
        resultText.textContent = "Result: Cannot solve for a";
        noteText.textContent = "Need b, c, d (and d ≠ 0).";
        methodPill.textContent = "Method: a = (b × c) / d";
        checkPill.textContent = "Check: —";
        return;
      }
      solvedVal = (b * c) / d;
      a = solvedVal;
      aEl.value = String(solvedVal);
      methodPill.textContent = "Method: a = (b × c) / d";
    }

    if (solveFor === "b") {
      if (!needValid(a, d, c) || c === 0) {
        resultText.textContent = "Result: Cannot solve for b";
        noteText.textContent = "Need a, c, d (and c ≠ 0).";
        methodPill.textContent = "Method: b = (a × d) / c";
        checkPill.textContent = "Check: —";
        return;
      }
      solvedVal = (a * d) / c;
      b = solvedVal;
      bEl.value = String(solvedVal);
      methodPill.textContent = "Method: b = (a × d) / c";
    }

    if (solveFor === "c") {
      if (!needValid(a, d, b) || b === 0) {
        resultText.textContent = "Result: Cannot solve for c";
        noteText.textContent = "Need a, b, d (and b ≠ 0).";
        methodPill.textContent = "Method: c = (a × d) / b";
        checkPill.textContent = "Check: —";
        return;
      }
      solvedVal = (a * d) / b;
      c = solvedVal;
      cEl.value = String(solvedVal);
      methodPill.textContent = "Method: c = (a × d) / b";
    }

    if (solveFor === "d") {
      if (!needValid(a, b, c) || a === 0) {
        resultText.textContent = "Result: Cannot solve for d";
        noteText.textContent = "Need a, b, c (and a ≠ 0).";
        methodPill.textContent = "Method: d = (b × c) / a";
        checkPill.textContent = "Check: —";
        return;
      }
      solvedVal = (b * c) / a;
      d = solvedVal;
      dEl.value = String(solvedVal);
      methodPill.textContent = "Method: d = (b × c) / a";
    }

    if (!Number.isFinite(solvedVal)) {
      resultText.textContent = "Result: —";
      noteText.textContent = "Could not solve. Make sure 3 values are filled.";
      checkPill.textContent = "Check: —";
      methodPill.textContent = "Method: —";
      return;
    }

    resultText.textContent = `Result: ${solveFor} = ${fmt(solvedVal, dps)}`;

    // Check
    const ok = checkEquality(a, b, c, d, tol);
    checkPill.textContent = ok ? "Check: ✅ a/b ≈ c/d" : "Check: ⚠ not equal";
    noteText.textContent = ok
      ? "Proportion holds (within tolerance)."
      : "The values do not satisfy the proportion (check your inputs or rounding).";

    save();
  }

  function clearAll() {
    aEl.value = "";
    bEl.value = "";
    cEl.value = "";
    dEl.value = "";
    resultText.textContent = "Result: —";
    checkPill.textContent = "Check: —";
    methodPill.textContent = "Method: —";
    noteText.textContent = "";
    save();
  }

  async function copyResult() {
    const t = resultText.textContent.trim();
    if (!t || t.endsWith("—")) return;
    try { await navigator.clipboard.writeText(t + "\n" + checkPill.textContent); } catch {}
  }

  // events
  [aEl,bEl,cEl,dEl,roundingEl,modeEl,toleranceEl].forEach(el => {
    el.addEventListener("input", () => save());
    el.addEventListener("change", () => calc());
  });

  calcBtn.addEventListener("click", calc);
  clearBtn.addEventListener("click", clearAll);
  copyBtn.addEventListener("click", copyResult);

  // shortcuts
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Enter") { e.preventDefault(); calc(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); clearAll(); }
  });

  // init
  load();
  calc();
})();
