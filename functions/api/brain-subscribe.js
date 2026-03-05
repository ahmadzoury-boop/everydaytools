export async function onRequestPost({ request, env }) {

  try {

    const body = await request.json().catch(()=>null);

    if (!body || !body.email) {
      return new Response(JSON.stringify({
        ok:false,
        error:"Missing email"
      }),{
        headers:{ "Content-Type":"application/json" }
      });
    }

    const email = body.email.trim().toLowerCase();

    await env.BRAIN_DB.prepare(
      `INSERT OR REPLACE INTO brain_subscribers (email, created_at)
       VALUES (?, datetime('now'))`
    )
    .bind(email)
    .run();

    return new Response(JSON.stringify({
      ok:true
    }),{
      headers:{ "Content-Type":"application/json" }
    });

  } catch(e){

    return new Response(JSON.stringify({
      ok:false,
      error:e.message
    }),{
      headers:{ "Content-Type":"application/json" }
    });

  }

}