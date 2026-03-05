export async function onRequest(context) {

  const { request, env } = context;
  const url = new URL(request.url);

  let email = "";

  // GET support
  if (request.method === "GET") {
    email = (url.searchParams.get("email") || "").trim().toLowerCase();
  }

  // POST support
  if (request.method === "POST") {
    try {
      const body = await request.json();
      email = (body.email || "").trim().toLowerCase();
    } catch {}
  }

  if (!email) {
    return Response.json({
      ok: false,
      error: "Missing email"
    });
  }

  /* ------------------------------
     SAVE SUBSCRIBER TO D1
  ------------------------------ */

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

  /* ------------------------------
     SEND EMAIL WITH RESEND
  ------------------------------ */

  try {

    const html = `
      <h2>🧠 Welcome to Daily Brain</h2>

      <p>You are now subscribed to the Daily Brain puzzles.</p>

      <p>
      Solve today's challenge here:
      </p>

      <p>
      <a href="https://everydaytools.uk/tools/brain">
      Open Daily Brain
      </a>
      </p>

      <hr>

      <p style="font-size:12px;color:#888">
      EverydayTools.uk
      </p>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Daily Brain <onboarding@resend.dev>",
        to: [email],
        subject: "🧠 Welcome to Daily Brain",
        html: html
      })
    });

  } catch (err) {

    console.log("Email error:", err);

  }

  return Response.json({
    ok:true
  });

}