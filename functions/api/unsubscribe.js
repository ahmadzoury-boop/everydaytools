const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

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
    if (!env.SUBSCRIBERS) {
      return htmlResponse(
        `<h3>Error</h3><p>Missing KV binding: SUBSCRIBERS</p>`,
        500
      );
    }

    const url = new URL(request.url);

    // Accept email from:
    // 1) query string: /api/unsubscribe?email=...
    // 2) POST JSON body: { "email": "..." }
    let email = (url.searchParams.get("email") || "").trim().toLowerCase();

    if (!email && request.method === "POST") {
      const ct = (request.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("application/json")) {
        const data = await request.json().catch(() => null);
        email = String(data?.email || "").trim().toLowerCase();
      } else {
        const form = await request.formData().catch(() => null);
        if (form) email = String(form.get("email") || "").trim().toLowerCase();
      }
    }

    if (!email) {
      return htmlResponse(
        `<h3>Unsubscribe</h3><p>Missing email.</p>`,
        400
      );
    }

    // Delete from KV (unsubscribe)
    await env.SUBSCRIBERS.delete(email);

    // Nice confirmation page (works in email clients + browsers)
    return htmlResponse(`
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:40px auto;padding:18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
        <h2 style="margin:0 0 10px">You’re unsubscribed ✅</h2>
        <p style="margin:0 0 14px;color:#374151">We removed <b>${email}</b> from our currency updates list.</p>
        <p style="margin:0;color:#6b7280;font-size:14px">If this was a mistake, you can re-subscribe anytime from EverydayTools.</p>
      </div>
    `);
  } catch (err) {
    return json({ success: false, error: err?.message || "Server error" }, 500);
  }
}
