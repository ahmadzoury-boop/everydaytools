const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// --- Helpers to make the confirmation email valuable ---
function formatNum(n, decimals = 6) {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  return n.toFixed(decimals).replace(/\.?0+$/, ""); // trim trailing zeros
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

// Pull: latest rate, reverse, last-available change, and 7-day min/max
async function getRateSnapshot(from, to) {
  const today = new Date();

  const latestUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const latestData = await fetchJson(latestUrl);
  const rate = Number(latestData?.rates?.[to]);
  const reverse = rate ? 1 / rate : null;
  const asOf = latestData?.date || formatDateISO(today);

  // 7-day range (last 7 calendar days)
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const histUrl = `https://api.frankfurter.app/${formatDateISO(start)}..${formatDateISO(today)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  let min7 = null, max7 = null;
  try {
    const hist = await fetchJson(histUrl);
    const dates = Object.keys(hist?.rates || {});
    const values = dates
      .map(d => Number(hist.rates[d]?.[to]))
      .filter(v => typeof v === "number" && isFinite(v));
    if (values.length) {
      min7 = Math.min(...values);
      max7 = Math.max(...values);
    }
  } catch (_) {
    // ignore history errors
  }

  // Change vs last available previous day (handles weekends/holidays by looking back)
  let prevRate = null;
  let prevDate = null;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = formatDateISO(d);
    try {
      const prev = await fetchJson(
        `https://api.frankfurter.app/${ds}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const r = Number(prev?.rates?.[to]);
      if (isFinite(r) && r > 0) {
        prevRate = r;
        prevDate = prev?.date || ds;
        break;
      }
    } catch (_) {
      // keep trying older days
    }
  }

  let changeAbs = null, changePct = null;
  if (prevRate && rate) {
    changeAbs = rate - prevRate;
    changePct = (changeAbs / prevRate) * 100;
  }

  return { rate, reverse, asOf, min7, max7, prevRate, prevDate, changeAbs, changePct };
}

export async function onRequest({ request, env }) {
  try {
    if (request.method !== "POST") {
      return json({ success: false, error: "POST only" }, 405);
    }

    // ---- Parse body (JSON or FormData) ----
    const ct = (request.headers.get("content-type") || "").toLowerCase();
    let data = null;

    if (ct.includes("application/json")) {
      data = await request.json().catch(() => null);
    } else {
      const form = await request.formData().catch(() => null);
      if (form) data = Object.fromEntries(form.entries());
    }

    if (!data) {
      return json({ success: false, error: "Invalid request body" }, 400);
    }

    const email = String(data.email || "").trim().toLowerCase();
    const frequency = String(data.frequency || "daily").trim().toLowerCase();
    const from = String(data.from || "USD").trim().toUpperCase();
    const to = String(data.to || "EUR").trim().toUpperCase();

    if (!email) return json({ success: false, error: "Email required" }, 400);

    if (!env.SUBSCRIBERS) {
      return json({ success: false, error: "Missing KV binding: SUBSCRIBERS" }, 500);
    }
    if (!env.RESEND_API_KEY) {
      return json({ success: false, error: "Missing secret: RESEND_API_KEY" }, 500);
    }

    // ---- Store in KV ----
    await env.SUBSCRIBERS.put(
      email,
      JSON.stringify({ email, frequency, from, to, subscribedAt: Date.now() })
    );

    // ---- Unsubscribe link ----
    const unsubscribeUrl =
      `https://everydaytools.uk/api/unsubscribe?email=${encodeURIComponent(email)}`;

    // ---- Build a valuable confirmation email (with real numbers) ----
    let snap = null;
    try {
      snap = await getRateSnapshot(from, to);
    } catch (_) {
      // snapshot is optional; still send confirmation
    }

    const rateLine = snap?.rate
      ? `1 ${from} = ${formatNum(snap.rate, 6)} ${to}`
      : `1 ${from} = — ${to}`;

    const reverseLine = snap?.reverse
      ? `1 ${to} = ${formatNum(snap.reverse, 6)} ${from}`
      : `1 ${to} = — ${from}`;

    const rangeLine = (snap?.min7 && snap?.max7)
      ? `7-day range: ${formatNum(snap.min7, 6)} → ${formatNum(snap.max7, 6)}`
      : `7-day range: —`;

    const changeLine = (typeof snap?.changePct === "number")
      ? `Change vs ${snap.prevDate}: ${snap.changePct >= 0 ? "+" : ""}${formatNum(snap.changePct, 2)}%`
      : `Change vs last day: —`;

    const asOfLine = snap?.asOf ? `As of: ${snap.asOf}` : "";

    const subject = `Subscribed ✅ ${from} → ${to} (${frequency})`;

    const html = `
      <h2>Subscription Confirmed ✅</h2>
      <p>You’re subscribed to <b>${frequency}</b> updates for <b>${from} → ${to}</b>.</p>

      <h3>Live snapshot</h3>
      <p><b>${rateLine}</b><br/>
         ${reverseLine}<br/>
         ${rangeLine}<br/>
         ${changeLine}<br/>
         <span style="color:#6b7280;font-size:12px">${asOfLine}</span>
      </p>

      <p style="margin-top:14px">
        View the live converter anytime:
        <a href="https://everydaytools.uk/tools/finance/currency-converter">${"everydaytools.uk/tools/finance/currency-converter"}</a>
      </p>

      <hr />
      <p style="font-size:12px;color:#6b7280">
        Don’t want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>
      </p>
    `;

    // Plain-text improves deliverability
    const text = [
      "Subscription Confirmed ✅",
      `You’re subscribed to ${frequency} updates for ${from} → ${to}.`,
      "",
      "Live snapshot:",
      rateLine,
      reverseLine,
      rangeLine,
      changeLine,
      asOfLine,
      "",
      "Converter:",
      "https://everydaytools.uk/tools/finance/currency-converter",
      "",
      `Unsubscribe: ${unsubscribeUrl}`
    ].filter(Boolean).join("\n");

    // ---- Send via Resend ----
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Everyday Tools <noreply@everydaytools.uk>",
        to: email,
        subject,
        html,
        text,
        headers: {
          "Reply-To": "support@everydaytools.uk",
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const sendText = await sendRes.text().catch(() => "");
    let sendJson = null;
    try { sendJson = JSON.parse(sendText); } catch {}

    if (!sendRes.ok) {
      console.error("Resend email error:", sendText);
      return json({
        success: true,
        warning: "Subscribed but email not sent",
        resend_error: sendText,
      });
    }

    return json({ success: true, resend_id: sendJson?.id || null });
  } catch (err) {
    return json({ success: false, error: err?.message || "Server error" }, 500);
  }
}
