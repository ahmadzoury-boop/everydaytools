export async function onRequest({ request, env }) {
  const { email } = await request.json();

  await env.DB.prepare(
    `UPDATE subscribers
     SET status='unsubscribed', unsubscribed_at=?
     WHERE email=?`
  )
    .bind(new Date().toISOString(), email.toLowerCase())
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
