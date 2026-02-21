// functions/api/rate-subscribe.js
// Handles POST /api/rate-subscribe from the currency converter page

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1) Parse JSON body sent from the page
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { success: false, error: "Invalid JSON body" },
      400
    );
  }

  const { email, frequency, from, to } = payload || {};

  // 2) Basic validation
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return jsonResponse(
      { success: false, error: "Missing or invalid email" },
      400
    );
  }

  if (!from || !to || from === to) {
    return jsonResponse(
      { success: false, error: "Please choose two different currencies" },
      400
    );
  }

  const freq = (frequency || "daily").toLowerCase();
  if (freq !== "daily" && freq !== "weekly") {
    return jsonResponse(
      { success: false, error: "Invalid frequency" },
      400
    );
  }

  // 3) OPTIONAL: Save to D1 (if you have a DB bound as RATES_DB)
  // If you don't have / don't want DB yet, you can ignore this –
  // the code will just skip it when env.RATES_DB is undefined.

  if (env.RATES_DB) {
    try {
      const nowIso = new Date().toISOString();
      await env.RATES_DB
        .prepare(
          `INSERT INTO rate_subscribers (email, base, quote, frequency, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(email.trim(), from.trim(), to.trim(), freq, nowIso)
        .run();
    } catch (err) {
      console.error("D1 insert error (rate_subscribers):", err);
      return jsonResponse(
        { success: false, error: "Database error while saving subscription" },
        500
      );
    }
  }

  // 4) TODO later: send welcome email via Resend/MailChannels
  // (we can wire this after it’s saving successfully)

  // 5) Success JSON (what the front-end expects)
  return jsonResponse({ success: true }, 200);
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://everydaytools.uk",
    },
  });
}