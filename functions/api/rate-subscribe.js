// functions/api/rate-subscribe.js
//
// Currency Converter subscription endpoint
// - Accepts JSON: { email, from, to, frequency }
// - Stores the subscription in KV (if bound as SUBSCRIBERS)
// - Fetches today's live rate for the pair
// - Sends a confirmation email via Resend that includes:
//     - Pair
//     - Frequency
//     - Today's rate + inverse
//     - Button + link back to the live converter with the pair preselected
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
        console.log("KV put error:", kvErr);
      }
    }

    // ---------- Fetch today's live rate for the pair ----------
    let todayRate = null;
    let inverseRate = null;
    let rateDate = null;

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
          rateDate = rateJson.date || null;
        }
      }
    } catch (rateErr) {
      console.log("Rate fetch error:", rateErr);
    }

    const pair = `${fromCode} → ${toCode}`;
    const niceFreq = frequency === "daily" ? "Daily" : "Weekly";

    // Link back to the converter with this pair preselected
    const baseUrl = "https://everydaytools.uk/tools/finance/currency-converter";
    const converterUrl =
      `${baseUrl}?from=${encodeURIComponent(fromCode)}` +
      `&to=${encodeURIComponent(toCode)}` +
      `&utm_source=rate_confirm&utm_medium=email&utm_campaign=currency_alerts`;

    // ---------- Build email content ----------
    const subject = `Subscribed to ${pair} ${niceFreq.toLowerCase()} rate alerts`;

    const dateLabel = rateDate ? ` (${rateDate})` : "";

    const rateLineHtml = todayRate
      ? `<p style="margin:0 0 10px;">
           <strong>Today’s rate${dateLabel}:</strong><br/>
           1 ${fromCode} ≈ ${formatNumber(todayRate, 6)} ${toCode}<br/>
           <strong>Inverse:</strong> 1 ${toCode} ≈ ${
          inverseRate ? formatNumber(inverseRate, 6) : "n/a"
        } ${fromCode}
         </p>`
      : `<p style="margin:0 0 10px;">
           <strong>Today’s rate:</strong> temporarily unavailable.
         </p>`;

    const html = `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;line-height:1.5;">
        <h1 style="font-size:20px;margin:0 0 10px;">You're subscribed ✅</h1>

        <p style="margin:0 0 10px;">
          Thanks for subscribing to exchange-rate alerts on
          <strong>EverydayTools.uk</strong>.
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">
          <tr>
            <td style="padding:0 12px 6px 0;"><strong>Pair:</strong></td>
            <td style="padding:0 0 6px 0;">${fromCode} → ${toCode}</td>
          </tr>
          <tr>
            <td style="padding:0 12px 0 0;"><strong>Frequency:</strong></td>
            <td style="padding:0 0 0 0;">${niceFreq}</td>
          </tr>
        </table>

        ${rateLineHtml}

        <p style="margin:16px 0 10px;">
          You can always check the live rate and chart here:
        </p>

        <!-- CTA button -->
        <p style="margin:0 0 14px;">
          <a href="${converterUrl}"
             style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
                    padding:10px 18px;border-radius:999px;font-weight:600;font-size:14px;">
            Open live converter for ${fromCode} → ${toCode}
          </a>
        </p>

        <!-- Plain link in case button styles are stripped -->
        <p style="margin:0 0 14px;font-size:12px;color:#555;">
          Or copy & paste this link into your browser:<br/>
          <a href="${converterUrl}" style="color:#2563eb;">${converterUrl}</a>
        </p>

        <p style="margin:10px 0 6px;font-size:13px;color:#333;">
          Each alert email will include today’s rate, the inverse rate,
          and a one-click link back to the live converter with your pair preselected.
        </p>

        <p style="margin:4px 0 6px;font-size:13px;color:#333;">
          You can also create more alerts from the converter page
          (for example <strong>EUR → TRY, weekly</strong>) if you track multiple pairs.
        </p>

        <p style="margin:4px 0 10px;font-size:13px;color:#333;">
          Coming next (like Daily Brain): optional <strong>daily/weekly digest emails</strong>
          with a small chart, last 7-day change, and a short summary of recent moves
          for your favourite pairs once the digest worker is enabled.
        </p>

        <p style="margin:10px 0 8px;font-size:12px;color:#555;">
          You’ll be able to unsubscribe any time using the link inside future alert emails.
        </p>

        <p style="margin:16px 0 0;font-size:11px;color:#999;">
          If you didn’t request this, you can safely ignore this message.
        </p>
      </div>
    `;

    const rateLineText = todayRate
      ? `Today’s rate${dateLabel}: 1 ${fromCode} ≈ ${formatNumber(
          todayRate,
          6
        )} ${toCode}; inverse: 1 ${toCode} ≈ ${
          inverseRate ? formatNumber(inverseRate, 6) : "n/a"
        } ${fromCode}`
      : "Today’s rate: temporarily unavailable.";

    const text = [
      "You're subscribed ✅",
      "",
      `Pair: ${pair}`,
      `Frequency: ${niceFreq}`,
      rateLineText,
      "",
      "Open live converter:",
      converterUrl,
      "",
      "Each alert email will include today’s rate, the inverse rate,",
      "and a one-click link back to the live converter with your pair preselected.",
      "",
      "You can also create more alerts from the converter page",
      "for example EUR → TRY, weekly, if you track multiple pairs.",
      "",
      "Coming next (like Daily Brain): optional daily/weekly digest emails with a small chart,",
      "last 7-day change, and a short summary of recent moves for your favourite pairs.",
      "",
      "You’ll be able to unsubscribe using the link in those emails.",
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