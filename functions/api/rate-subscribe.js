const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function onRequestOptions() {
  // CORS preflight
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // Allow only POST
    if (request.method !== "POST") {
      return json({ success: false, error: "POST only" }, 405);
    }

    // Ensure KV binding exists
    if (!env?.SUBSCRIBERS || typeof env.SUBSCRIBERS.put !== "function") {
      return json(
        {
          success: false,
          error:
            "Server misconfiguration: KV binding 'SUBSCRIBERS' is missing. Check Pages/Workers bindings.",
        },
        500
      );
    }

    // Parse body safely (JSON OR form-data)
    const ct = (request.headers.get("content-type") || "").toLowerCase();
    let data = null;

    if (ct.includes("application/json")) {
      data = await request.json().catch(() => null);
    } else if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      const fd = await request.formData().catch(() => null);
      if (fd) data = Object.fromEntries(fd.entries());
    } else {
      // fallback: try text -> JSON
      const text = await request.text().catch(() => "");
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
    }

    if (!data) {
      return json(
        { success: false, error: "Invalid JSON or empty request body" },
        400
      );
    }

    const email = String(data.email || "").trim().toLowerCase();
    const frequency = data.frequency ?? null;
    const from = data.from ?? null;
    const to = data.to ?? null;

    if (!email) {
      return json({ success: false, error: "Email is required" }, 400);
    }

    // Basic email validation
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return json({ success: false, error: "Invalid email" }, 400);
    }

    // Store in KV
    await env.SUBSCRIBERS.put(
      email,
      JSON.stringify({
        email,
        frequency,
        from,
        to,
        subscribedAt: Date.now(),
      })
    );

    return json({ success: true }, 200);
  } catch (err) {
    return json(
      { success: false, error: err?.message || "Server error" },
      500
    );
  }
}
