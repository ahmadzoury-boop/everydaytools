export async function onRequest(context) {

  const { request, env } = context;
  const url = new URL(request.url);

  let email = "";

  /* -------------------------
     GET ?email=
  ------------------------- */
  if (request.method === "GET") {
    email = (url.searchParams.get("email") || "").trim().toLowerCase();
  }

  /* -------------------------
     POST JSON
  ------------------------- */
  if (request.method === "POST") {
    try {
      const body = await request.json();
      email = (body.email || "").trim().toLowerCase();
    } catch {}
  }

  if (!email) {
    return Response.json({
      ok:false,
      error:"Missing email"
    });
  }

  /* -------------------------
     SAVE SUBSCRIBER
  ------------------------- */

  try {

    await env.BRAIN_DB.prepare(`
      INSERT INTO brain_subscribers (email, created_at)
      VALUES (?, datetime('now'))
      ON CONFLICT(email) DO NOTHING
    `)
    .bind(email)
    .run();

  } catch (err) {

    return Response.json({
      ok:false,
      error:String(err)
    });

  }

  /* -------------------------
     SEND EMAIL (Resend)
  ------------------------- */

  try {

    const html = `
      <h2>🧠 Welcome to Daily Brain</h2>

      <p>You are now subscribed to Daily Brain.</p>

      <p>
      Start today's puzzle:
      <br><br>
      <a href="https://everydaytools.uk/tools/brain/">
      Open Daily Brain
      </a>
      </p>
    `;

    await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${env.RESEND_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        from: `${env.BRAIN_FROM_NAME} <${env.BRAIN_FROM_EMAIL}>`,
        to:[email],
        subject:"🧠 Welcome to Daily Brain",
        html
      })
    });

  } catch (err) {

    console.log("Email error:",err);

  }

  return Response.json({
    ok:true
  });

}