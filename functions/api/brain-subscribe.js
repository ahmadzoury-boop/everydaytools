export async function onRequest(context) {
  const { request, env } = context;

  try {
    let email = "";

    const ct = request.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      const body = await request.json();
      email = (body.email || "").trim().toLowerCase();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      email = (form.get("email") || "").toString().trim().toLowerCase();
    }

    if (!email) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing email"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    await env.DIGEST_DB.prepare(
      `INSERT INTO brain_subscribers (email, created_at)
       VALUES (?, ?)
       ON CONFLICT(email) DO NOTHING`
    )
      .bind(email, new Date().toISOString())
      .run();

    return new Response(JSON.stringify({
      ok: true,
      message: "Subscribed"
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.message
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}