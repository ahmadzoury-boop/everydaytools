export async function onRequest({ request, env }) {
  try {
    const { email } = await request.json();
    if (!email || !email.includes("@")) {
      return new Response("Invalid email", { status: 400 });
    }

    const lower = email.toLowerCase();
    const now = new Date().toISOString();

    // 1) Save to D1
    await env.DB.prepare(
      `INSERT INTO subscribers (email, status, created_at)
       VALUES (?, 'active', ?)
       ON CONFLICT(email) DO UPDATE SET status='active'`
    ).bind(lower, now).run();

    // 2) Send welcome email via MailChannels
    const mail = {
      personalizations: [
        {
          to: [{ email: lower }],
          from: { email: "no-reply@everydaytools.uk", name: "EverydayTools — Daily Brain" },
          subject: "You're subscribed to Daily Brain 🧠",
        },
      ],
      content: [
        {
          type: "text/html",
          value: `
            <h2>Welcome to Daily Brain 🧠</h2>
            <p>Thanks for subscribing! You'll receive one short daily challenge every morning.</p>
            <p>No spam. No ads. Just one brain puzzle a day.</p>
            <br>
            <p style="opacity:0.7">If you didn't mean to subscribe, you can unsubscribe anytime.</p>
          `,
        },
      ],
    };

    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mail),
    });

    if (!res.ok) {
      console.error("MailChannels error:", await res.text());
      return new Response(JSON.stringify({ ok: false, error: "email_failed" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}
