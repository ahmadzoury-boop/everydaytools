export async function onRequest(context) {

  try {

    const { request, env } = context;

    const url = new URL(request.url);
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({
        ok:false,
        error:"Missing email"
      }),{
        headers:{ "Content-Type":"application/json" }
      });
    }

    if (!env.BRAIN_DB) {
      return new Response(JSON.stringify({
        ok:false,
        error:"BRAIN_DB binding missing"
      }),{
        headers:{ "Content-Type":"application/json" }
      });
    }

    await env.BRAIN_DB.prepare(`
      INSERT INTO brain_subscribers (email, created_at)
      VALUES (?1, datetime('now'))
      ON CONFLICT(email) DO NOTHING
    `)
    .bind(email)
    .run();

    return new Response(JSON.stringify({
      ok:true,
      email
    }),{
      headers:{ "Content-Type":"application/json" }
    });

  } catch(err){

    return new Response(JSON.stringify({
      ok:false,
      error: err.message
    }),{
      headers:{ "Content-Type":"application/json" }
    });

  }

}