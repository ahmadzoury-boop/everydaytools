// functions/api/rate-subscribe.js
//
// Currency Converter subscription endpoint
// - Accepts JSON: { email, from, to, frequency }
// - Stores the subscription in KV (if bound as SUBSCRIBERS)
// - Fetches today's live rate for the pair
// - Sends a confirmation email via Resend that includes:
//     - Pair
//     - Frequency
//     - Today's rate
// - Returns JSON: { success: true } or { success: false, error: ... }
//
// Required env vars (Pages → Settings → Variables & Secrets):
//   RESEND_API_KEY    (Resend token, starts with "re_...")
//   RATE_FROM_EMAIL   (e.g. "alerts@everydaytools.uk")
//   RATE_FROM_NAME    (e.g. "EverydayTools Currency Alerts")
// Optional binding:
//   SUBSCRIBERS       (KV namespace for storing subscriptions)

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

export async function onRequestOptions() {
  // Basic CORS preflight
  return new Response(null, {
    status: 204,
    headers: {
      ...JSON_HEADERS,
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    // ---------- Parse and validate input ----------
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const email = String(body.email || "").trim();
    const fromCode = String(body.from || "").trim().toUpperCase();
    const toCode = String(body.to || "").trim().toUpperCase();
    const frequencyRaw = String(body.frequency || "").trim().toLowerCase();

    if (!email) {
      return jsonError("Missing email", 400);
    }
    if (!fromCode || !toCode || fromCode === toCode) {
      return jsonError("Please choose two different currencies", 400);
    }

    const frequency = frequencyRaw === "weekly" ? "weekly" : "daily";

    // ---------- Check Resend config ----------
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      return jsonError("Missing RESEND_API_KEY in environment", 500);
    }

    const fromEmail =
      env.RATE_FROM_EMAIL || "alerts@everydaytools.uk";
    const fromName =
      env.RATE_FROM_NAME || "EverydayTools Currency Alerts";
    const fromHeader = `${fromName} <${fromEmail}>`;

    // ---------- Store subscription in KV (if available) ----------
    // This gives us a foundation for a future daily/weekly worker.
    if (env.SUBSCRIBERS && typeof env.SUBSCRIBERS.put === "function") {
      const key = `rates:${email.toLowerCase()}:${fromCode}-${toCode}:${frequency}`;
      const now = new Date().toISOString();
      const record = {
        kind: "currency-rate-subscription",
        email,
        from: fromCode,
        to: toCode,
        frequency,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await env.SUBSCRIBERS.put(key, JSON.stringify(record));
      } catch (kvErr) {
        // Don't fail the whole request if KV write fails; just log in the response.
        console.log("KV put error:", kvErr);
      }
    }

    // ---------- Fetch today's live rate for the pair ----------
    let todayRate = null;
    let inverseRate = null;

    try {
      const rateRes = await fetch(
        `https://api.frankfurter.app/latest?from=${encodeURIComponent(
          fromCode
        )}&to=${encodeURIComponent(toCode)}`
      );
      if (rateRes.ok) {
        const rateJson = await rateRes.json();
        const r =
          rateJson &&
          rateJson.rates &&
          typeof rateJson.rates[toCode] === "number"
            ? rateJson.rates[toCode]
            : null;
        if (typeof r === "number" && isFinite(r)) {
          todayRate = r;
          inverseRate = r !== 0 ? 1 / r : null;
        }
      }
    } catch (rateErr) {
      console.log("Rate fetch error:", rateErr);
    }

    const pair = `${fromCode} → ${toCode}`;
    const niceFreq = frequency === "daily" ? "Daily" : "Weekly";

    // ---------- Build email content ----------
    const subject = `Subscribed to ${pair} ${niceFreq.toLowerCase()} rate alerts`;

    const rateLineHtml = todayRate
      ? `<p style="margin:0 0 8px;">
           <strong>Today’s rate:</strong>
           1 ${fromCode} ≈ ${formatNumber(todayRate, 6)} ${toCode}${
          inverseRate
            ? `<br/><strong>Inverse:</strong> 1 ${toCode} ≈ ${formatNumber(
                inverseRate,
                6
              )} ${fromCode}`
            : ""
        }
         </p>`
      : `<p style="margin:0 0 8px;">
           <strong>Today’s rate:</strong> temporarily unavailable.
         </p>`;

    const html = `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;">
        <h1 style="font-size:18px;margin-bottom:8px;">You're subscribed ✅</h1>
        <p style="margin:0 0 8px;">
          Thanks for subscribing to exchange-rate alerts on <strong>EverydayTools.uk</strong>.
        </p>
        <p style="margin:0 0 8px;">
          <strong>Pair:</strong> ${fromCode} → ${toCode}<br/>
          <strong>Frequency:</strong> ${niceFreq}
        </p>
        ${rateLineHtml}
        <p style="margin:0 0 8px;">
          You'll start receiving emails with the latest mid-market rate for this pair,
          plus a short summary of recent moves (once the daily/weekly digest worker is enabled).
        </p>
        <p style="margin:0 0 8px;font-size:12px;color:#555;">
          You can unsubscribe any time using the link inside each future email.
        </p>
        <p style="margin-top:18px;font-size:12px;color:#777;">
          If you didn’t request this, you can safely ignore this message.
        </p>
      </div>
    `;

    const rateLineText = todayRate
      ? `Today’s rate: 1 ${fromCode} ≈ ${formatNumber(
          todayRate,
          6
        )} ${toCode}${
          inverseRate
            ? ` | Inverse: 1 ${toCode} ≈ ${formatNumber(
                inverseRate,
                6
              )} ${fromCode}`
            : ""
        }`
      : "Today’s rate: temporarily unavailable.";

    const text = [
      "You're subscribed ✅",
      "",
      `Pair: ${pair}`,
      `Frequency: ${niceFreq}`,
      rateLineText,
      "",
      "You'll start receiving emails with the latest mid-market rate for this pair.",
      "You can unsubscribe any time using the link in each email (once digests are enabled).",
      "",
      "If you didn’t request this, you can ignore this message.",
    ].join("\n");

    // ---------- Send via Resend ----------
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: email,
        subject,
        text,
        html,
      }),
    });

    const resendText = await resendRes.text();
    if (!resendRes.ok) {
      // Return 200 so frontend can show friendly error
      return new Response(
        JSON.stringify({
          success: false,
          error: `Resend error (${resendRes.status}): ${resendText.slice(
            0,
            300
          )}`,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // All good
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    return jsonError(err?.message || "Unexpected error", 500);
  }
}

// ---------- Helpers ----------

function jsonError(message, status) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: JSON_HEADERS }
  );
}

function formatNumber(value, decimals) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(decimals);
}