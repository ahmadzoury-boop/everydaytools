// functions/api/rate-subscribe.js
//
// Currency converter subscription endpoint
// - Accepts JSON: { email, from, to, frequency }
// - Sends a confirmation email via Resend
// - Returns { success: true } on OK
//
// Required env vars (Cloudflare Pages -> Settings -> Environment variables):
// - RESEND_API_KEY        (same one you already use for Daily Brain)
// Optional:
// - RATE_FROM_EMAIL       (e.g. "alerts@everydaytools.uk")
// - RATE_FROM_NAME        (e.g. "EverydayTools Currency Alerts")

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

export async function onRequestOptions() {
  // Basic CORS preflight handler
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
    // ---- Parse and validate body ----
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const email = String(body.email || "").trim();
    const fromCode = String(body.from || "").trim().toUpperCase();
    const toCode = String(body.to || "").trim().toUpperCase();
    const frequencyRaw = String(body.frequency || "").trim().toLowerCase();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    if (!fromCode || !toCode || fromCode === toCode) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please choose two different currencies",
        }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const frequency =
      frequencyRaw === "weekly" ? "weekly" : "daily"; // default to daily

    // ---- Resend config ----
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing RESEND_API_KEY in environment",
        }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const fromEmail =
      env.RATE_FROM_EMAIL || "alerts@everydaytools.uk"; // adjust if needed
    const fromName =
      env.RATE_FROM_NAME || "EverydayTools Currency Alerts";

    const fromHeader = `${fromName} <${fromEmail}>`;

    // ---- Build confirmation email ----
    const pair = `${fromCode} → ${toCode}`;
    const subj = `Subscribed to ${pair} ${frequency} rate alerts`;

    const html = `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;">
        <h1 style="font-size:18px;margin-bottom:8px;">You're subscribed ✅</h1>
        <p style="margin:0 0 8px;">Thanks for subscribing to exchange-rate alerts on <strong>EverydayTools.uk</strong>.</p>
        <p style="margin:0 0 8px;">
          <strong>Pair:</strong> ${pair}<br/>
          <strong>Frequency:</strong> ${frequency === "daily" ? "Daily" : "Weekly"}
        </p>
        <p style="margin:0 0 8px;">
          You'll start receiving emails with the latest mid-market rate for this pair,
          plus a short summary of recent moves.
        </p>
        <p style="margin:0 0 8px;font-size:12px;color:#555;">
          You can unsubscribe any time using the link inside each email.
        </p>
        <p style="margin-top:18px;font-size:12px;color:#777;">
          If you didn’t request this, you can safely ignore this message.
        </p>
      </div>
    `;

    const text = [
      "You're subscribed ✅",
      "",
      `Pair: ${pair}`,
      `Frequency: ${frequency}`,
      "",
      "You'll start receiving exchange-rate emails for this pair.",
      "You can unsubscribe any time using the link in each email.",
      "",
      "If you didn’t request this, you can ignore this message.",
    ].join("\n");

    // ---- Call Resend ----
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: email,
        subject: subj,
        text,
        html,
      }),
    });

    const resendText = await resendRes.text();
    if (!resendRes.ok) {
      // Log the error to the response so frontend can show it (but still 200 so we see it nicely)
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

    // Optionally you could parse the JSON: const resendData = JSON.parse(resendText);

    // ---- All good ----
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Unexpected error",
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}