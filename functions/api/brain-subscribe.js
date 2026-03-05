export async function onRequestPost(context) {

  const { request, env } = context;

  let body = {};

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok:false, error:"Invalid request" });
  }

  const email = (body.email || "").trim().toLowerCase();

  if (!email) {
    return Response.json({ ok:false, error:"Missing email" });
  }

  try {

    // Save subscriber
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

  /* =========================
     SEND WELCOME EMAIL
  ========================= */

  try {

    const html = `
      <h2>🧠 Welcome to Daily Brain</h2>

      <p>You are now subscribed to Daily Brain on EverydayTools.uk.</p>

      <p>Every day you will receive a short brain puzzle.</p>

      <p>
      Open today’s puzzle here:
      <br><br>
      <a href="https://everydaytools.uk/tools/brain/">
      Start today's puzzle
      </a>
      </p>

      <p>Good luck!</p>
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

  } catch (e) {
    console.log("Email send failed:", e);
  }

  return Response.json({
    ok:true
  });

}