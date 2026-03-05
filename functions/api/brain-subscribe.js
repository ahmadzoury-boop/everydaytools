export async function onRequest(context) {

  const { request, env } = context;
  const url = new URL(request.url);

  let email = "";

  // GET request support
  if (request.method === "GET") {
    email = (url.searchParams.get("email") || "").trim().toLowerCase();
  }

  // POST request support
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

  // Save subscriber
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
      ok: false,
      error: String(err)
    });
  }

  // Send email via Resend
  try {

    const payload = {
      from: "Daily Brain <hello@everydaytools.uk>",
      to: [email],
      subject: "Welcome to Daily Brain 🧠",
      html: `
        <h2>Welcome to Daily Brain</h2>

        <p>You are now subscribed.</p>

        <p>
        Play today's puzzle:
        <br><br>
        <a href="https://everydaytools.uk/tools/brain/">
        Open Daily Brain
        </a>
        </p>
      `
    };

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

  } catch (err) {
    console.log("Email error:", err);
  }

  return Response.json({
    ok: true
  });

}