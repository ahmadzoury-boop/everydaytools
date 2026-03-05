export async function onRequestPost(context) {

  const { request, env } = context;

  let body = {};

  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({
      ok:false,
      error:"Invalid JSON body"
    }),{
      headers:{ "Content-Type":"application/json" }
    });
  }

  const email = (body.email || "").trim().toLowerCase();

  if (!email) {
    return new Response(JSON.stringify({
      ok:false,
      error:"Missing email"
    }),{
      headers:{ "Content-Type":"application/json" }
    });
  }

  try {

    await env.BRAIN_DB.prepare(`
      INSERT INTO brain_subscribers (email, created_at)
      VALUES (?, datetime('now'))
      ON CONFLICT(email) DO NOTHING
    `)
    .bind(email)
    .run();

  } catch (err) {

    return new Response(JSON.stringify({
      ok:false,
      error:String(err)
    }),{
      headers:{ "Content-Type":"application/json" }
    });

  }

  return new Response(JSON.stringify({
    ok:true
  }),{
    headers:{ "Content-Type":"application/json" }
  });

}