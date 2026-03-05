export async function onRequest(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ ok:false, error:"Missing email" }), {
        headers:{ "Content-Type":"application/json" }
      });
    }

    await env.DIGEST_DB.prepare(
      `INSERT INTO brain_subscribers (email, created_at)
       VALUES (?, ?)
       ON CONFLICT(email) DO NOTHING`
    )
    .bind(email, new Date().toISOString())
    .run();

    return new Response(JSON.stringify({ ok:true }), {
      headers:{ "Content-Type":"application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      ok:false,
      error:err.message
    }),{
      headers:{ "Content-Type":"application/json" }
    });
  }
}