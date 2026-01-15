export async function onRequest({ request, env }) {
  const { email } = await request.json();
  if (!email) return new Response("Invalid", { status: 400 });

  await env.DB.prepare(
    `INSERT INTO subscribers (email, status, created_at)
     VALUES (?, 'active', ?)
     ON CONFLICT(email) DO UPDATE SET status='active'`
  )
    .bind(email.toLowerCase(), new Date().toISOString())
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
