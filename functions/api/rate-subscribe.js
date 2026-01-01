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

export async function onRequest({ request, env }) {
  try {
    if (request.method !== "POST") {
      return json({ success: false, error: "POST only" }, 405);
    }

    // ---- Parse the body ----
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
    const frequency = data.frequency || "daily";
    const from = data.from || "USD";
    const to = data.to || "EUR";

    if (!email) return json({ success: false, error: "Email required" }, 400);
    if (!env.SUBSCRIBERS)
      return json({ success: false, error: "Missing KV binding: SUBSCRIBERS" }, 500);
    if (!env.RESEND_API_KEY)
      return json({ success: false, error: "Missing secret: RESEND_API_KEY" }, 500);

    // ---- Store in KV ----
    await env.SUBSCRIBERS.put(
      email,
      JSON.stringify({ email, frequency, from, to, subscribedAt: Date.now() })
    );

    // ---- Send confirmation email through Resend ----
    const subject = "You're subscribed to currency updates!";
    const html = `
      <h2>Subscription Confirmed ✅</h2>
      <p>Hello!</p>
      <p>You’ll now receive <strong>${frequency}</strong> exchange-rate updates for
      <strong>${from} → ${to}</strong>.</p>
      <p>— Everyday Tools Team</p>
    `;

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@everydaytools.uk",
        to: email,
        subject,
        html,
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Email error:", errText);
      return json({ success: true, warning: "Subscribed but email not sent" });
    }

    return json({ success: true });
  } catch (err) {
    return json({ success: false, error: err.message || "Server error" }, 500);
  }
}
