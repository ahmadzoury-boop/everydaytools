export async function onRequest(context) {

  const email = context.request.url.split("email=")[1];

  if (!email) {
    return new Response(JSON.stringify({ ok:false,error:"Missing email"}));
  }

  const db = context.env.BRAIN_DB;

  await db.prepare(`
    INSERT INTO brain_subscribers(email,created_at)
    VALUES(?1,datetime('now'))
    ON CONFLICT(email) DO NOTHING
  `).bind(email).run();

  return new Response(JSON.stringify({ ok:true }));
}