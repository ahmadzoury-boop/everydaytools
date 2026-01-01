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
  // ⚠️ Version marker to confirm deployment
  const VERSION = "rate-subscribe-vDEBUG-2026-01-01";

  try {
    if (request.method !== "POST") {
      return json({ success: false, error: "POST only", version: VERSION }, 405);
    }

    if (!env?.SUBSCRIBERS || typeof env.SUBSCRIBERS.put !== "function") {
      return json(
        {
          success: false,
          error: "Missing KV binding: SUBSCRIBERS",
          version: VERSION,
        },
        500
      );
    }

    const ct = (request.headers.get("content-type") || "").toLowerCase();

    // Read raw body once (works no matter what frontend sends)
    const raw = await request.text().catch(() => "");
    const rawTrim = raw.trim();

    let data = null;

    // If it looks like JSON, parse it
    if (rawTrim.startsWith("{") || rawTrim.startsWith("[")) {
      try {
        data = JSON.parse(rawTrim);
      } catch {
        data = null;
      }
    } else {
      // Otherwise try form-urlencoded (even if Content-Type is missing/wrong)
      const params = new URLSearchParams(raw);
      if ([...params.keys()].length) {
        data = Object.fromEntries(params.entries());
      }
    }

    // If Content-Type says form-data/urlencoded, also try formData()
    // (Sometimes request.text() gives empty for certain multi-part edge cases)
    if (
      !data &&
      (ct.includes("multipart/form-data") ||
        ct.includes("application/x-www-form-urlencoded"))
    ) {
      const fd = await request.formData().catch(() => null);
      if (fd) data = Object.fromEntries(fd.entries());
    }

    if (!data) {
      return json(
        {
          success: false,
          error: "Invalid body (not JSON or form-urlencoded)",
          version: VERSION,
          debug: {
            contentType: ct || "(missing)",
            rawLength: raw.length,
            rawPreview: raw.slice(0, 200),
          },
        },
        400
      );
    }

    const email = String(data.email || "").trim().toLowerCase();
    const frequency = data.frequency ?? null;
    const from = data.from ?? null;
    const to = data.to ?? null;

    if (!email) {
      return json({ success: false, error: "Email is required", version: VERSION }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, error: "Invalid email", version: VERSION }, 400);
    }

    await env.SUBSCRIBERS.put(
      email,
      JSON.stringify({ email, frequency, from, to, subscribedAt: Date.now() })
    );

    return json({ success: true, version: VERSION }, 200);
  } catch (err) {
    return json(
      { success: false, error: err?.message || "Server error", version: VERSION },
      500
    );
  }
}
