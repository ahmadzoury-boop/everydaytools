(() => {
  const LS_KEY = "percent_calc_v1";

  const tabsWrap = document.getElementById("tabs");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = {
    of: document.getElementById("panel-of"),
    change: document.getElementById("panel-change"),
    reverse: document.getElementById("panel-reverse")
  };

  // Tab 1
  const p1 = document.getElementById("p1");
  const n1 = document.getElementById("n1");
  const round1 = document.getElementById("round1");
  const calc1 = document.getElementById("calc1");
  const out1 = document.getElementById("out1");
  const note1 = document.getElementById("note1");

  // Tab 2
  const a2 = document.getElementById("a2");
  const b2 = document.getElementById("b2");
  const round2 = document.getElementById("round2");
  const calc2 = document.getElementById("calc2");
  const out2 = document.getElementById("out2");
  const pill2a = document.getElementById("pill2a");
  const pill2b = document.getElementById("pill2b");
  const note2 = document.getElementById("note2");

  // Tab 3
  const x3 = document.getElementById("x3");
  const p3 = document.getElementById("p3");
  const dir3 = document.getElementById("dir3");
  const calc3 = document.getElementById("calc3");
  const out3 = document.getElementById("out3");
  const note3 = document.getElementById("note3");

  const resetBtn = document.getElementById("resetBtn");
  const copyBtn = document.getElementById("copyBtn");

  let activeTab = "of";

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function fmt(n, d) {
    const dec = Number(d);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(dec);
  }

  function setTab(tab) {
    activeTab = tab;
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    Object.keys(panels).forEach(k => panels[k].classList.toggle("hidden", k !== tab));
    save();
  }

  function save() {
    const data = {
      activeTab,
      p1: p1.value, n1: n1.value, round1: round1.value,
      a2: a2.value, b2: b2.value, round2: round2.value,
      x3: x3.value, p3: p3.value, dir3: dir3.value
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;

      if (d.p1 != null) p1.value = d.p1;
      if (d.n1 != null) n1.value = d.n1;
      if (d.round1 != null) round1.value = d.round1;

      if (d.a2 != null) a2.value = d.a2;
      if (d.b2 != null) b2.value = d.b2;
      if (d.round2 != null) round2.value = d.round2;

      if (d.x3 != null) x3.value = d.x3;
      if (d.p3 != null) p3.value = d.p3;
      if (d.dir3 != null) dir3.value = d.dir3;

      if (d.activeTab) setTab(d.activeTab);
    } catch {}
  }

  function calcTab1() {
    const P = num(p1.value);
    const N = num(n1.value);
    const d = round1.value;

    if (!Number.isFinite(P) || !Number.isFinite(N)) {
      out1.textContent = "Result: —";
      note1.textContent = "Enter valid numbers.";
      return;
    }

    const res = (P / 100) * N;
    out1.textContent = `Result: ${fmt(res, d)}`;
    note1.textContent = `${fmt(P, 2)}% of ${fmt(N, 2)} = ${fmt(res, d)}`;
  }

  function calcTab2() {
    const A = num(a2.value);
    const B = num(b2.value);
    const d = round2.value;

    if (!Number.isFinite(A) || !Number.isFinite(B)) {
      out2.textContent = "Change: —";
      pill2a.textContent = "Difference: —";
      pill2b.textContent = "Direction: —";
      note2.textContent = "Enter valid numbers.";
      return;
    }

    const diff = B - A;
    pill2a.textContent = `Difference: ${fmt(diff, d)}`;

    if (A === 0) {
      out2.textContent = "Change: N/A (old value is 0)";
      pill2b.textContent = diff >= 0 ? "Direction: Increase" : "Direction: Decrease";
      note2.textContent = "Percent change is undefined when the old value is 0.";
      return;
    }

    const pct = (diff / A) * 100;
    const dir = diff >= 0 ? "Increase" : "Decrease";
    out2.textContent = `Change: ${fmt(pct, d)}%`;
    pill2b.textContent = `Direction: ${dir}`;
    note2.textContent = `${fmt(A, 2)} → ${fmt(B, 2)} is a ${fmt(Math.abs(pct), d)}% ${dir.toLowerCase()}.`;
  }

  function calcTab3() {
    const X = num(x3.value);
    const P = num(p3.value);

    if (!Number.isFinite(X) || !Number.isFinite(P)) {
      out3.textContent = "Original: —";
      note3.textContent = "Enter valid numbers.";
      return;
    }

    const rate = P / 100;
    const dir = dir3.value;

    let original;
    if (dir === "increase") {
      const k = 1 + rate;
      if (k === 0) { out3.textContent = "Original: —"; note3.textContent = "Invalid rate."; return; }
      original = X / k;
      out3.textContent = `Original: ${original.toFixed(2)}`;
      note3.textContent = `If original increased by ${P}% to become ${X}, then original = ${X} / (1 + ${rate.toFixed(2)})`;
    } else {
      const k = 1 - rate;
      if (k === 0) { out3.textContent = "Original: —"; note3.textContent = "Invalid rate."; return; }
      original = X / k;
      out3.textContent = `Original: ${original.toFixed(2)}`;
      note3.textContent = `If original decreased by ${P}% to become ${X}, then original = ${X} / (1 − ${rate.toFixed(2)})`;
    }
  }

  function calcActive() {
    if (activeTab === "of") calcTab1();
    if (activeTab === "change") calcTab2();
    if (activeTab === "reverse") calcTab3();
    save();
  }

  function resetAll() {
    p1.value = "15"; n1.value = "200"; round1.value = "2";
    a2.value = "80"; b2.value = "100"; round2.value = "2";
    x3.value = "120"; p3.value = "20"; dir3.value = "increase";
    setTab("of");

    out1.textContent = "Result: —"; note1.textContent = "";
    out2.textContent = "Change: —"; pill2a.textContent = "Difference: —"; pill2b.textContent = "Direction: —"; note2.textContent = "";
    out3.textContent = "Original: —"; note3.textContent = "";

    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  async function copyCurrent() {
    let text = "";
    if (activeTab === "of") text = out1.textContent;
    if (activeTab === "change") text = out2.textContent + "\n" + pill2a.textContent + "\n" + pill2b.textContent;
    if (activeTab === "reverse") text = out3.textContent;
    try { await navigator.clipboard.writeText(text.trim()); } catch {}
  }

  // Events
  tabsWrap.addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    setTab(t.dataset.tab);
    calcActive();
  });

  calc1.addEventListener("click", () => { setTab("of"); calcTab1(); save(); });
  calc2.addEventListener("click", () => { setTab("change"); calcTab2(); save(); });
  calc3.addEventListener("click", () => { setTab("reverse"); calcTab3(); save(); });

  [p1,n1,round1,a2,b2,round2,x3,p3,dir3].forEach(el => {
    el.addEventListener("input", () => save());
    el.addEventListener("change", () => calcActive());
  });

  resetBtn.addEventListener("click", resetAll);
  copyBtn.addEventListener("click", copyCurrent);

  // Shortcuts (ignore typing)
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "1") setTab("of");
    if (e.key === "2") setTab("change");
    if (e.key === "3") setTab("reverse");

    if (e.key === "Enter") { e.preventDefault(); calcActive(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); resetAll(); }
  });

  // Init
  load();
  calcActive();
})();
