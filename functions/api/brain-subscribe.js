export async function onRequest(context) {

  const { request, env } = context;

  let email;

  if (request.method === "POST") {
    const body = await request.json().catch(()=>({}));
    email = body.email;
  } else {
    const url = new URL(request.url);
    email = url.searchParams.get("email");
  }

  if (!email) {
    return new Response(JSON.stringify({
      ok:false,
      error:"Missing email"
    }),{headers:{'Content-Type':'application/json'}});
  }

  await env.BRAIN_DB.prepare(`
    INSERT INTO brain_subscribers (email, created_at)
    VALUES (?1, datetime('now'))
    ON CONFLICT(email) DO NOTHING
  `).bind(email).run();

  return new Response(JSON.stringify({
    ok:true,
    email
  }),{
    headers:{'Content-Type':'application/json'}
  });
}