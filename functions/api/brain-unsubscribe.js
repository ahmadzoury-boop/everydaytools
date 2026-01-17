export async function onRequest({ request, env }) {
  try {
    const { email } = await request.json();
    if (!email || !email.includes("@")) {
      return new Response("Invalid email", { status: 400 });
    }

    const lower = email.toLowerCase();
    const now = new Date().toISOString();

    // 1) Update D1 status → inactive
    await env.DB.prepare(
      `INSERT INTO subscribers (email, status, unsubscribed_at, created_at)
       VALUES (?, 'inactive', ?, ?)
       ON CONFLICT(email) DO UPDATE SET status='inactive', unsubscribed_at=?`
    )
      .bind(lower, now, now, now)
      .run();

    // 2) Send the unsubscribe confirmation email via MailChannels
    const mail = {
      personalizations: [
        {
          to: [{ email: lower }],
          from: {
            email: "no-reply@everydaytools.uk",
            name: "EverydayTools — Daily Brain",
          },
          subject: "You've been unsubscribed from Daily Brain",
        },
      ],
      content: [
        {
          type: "text/html",
          value: `
            <h2>You’ve been unsubscribed</h2>
            <p>We're sorry to see you go.</p>
            <p>You will no longer receive Daily Brain emails.</p>
            <br>
            <p style="opacity:0.7">If this was a mistake, simply re-subscribe from the website anytime.</p>
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
      console.error("MailChannels unsubscribe error:", await res.text());
      return new Response(JSON.stringify({ ok: false, error: "email_failed" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unsubscribe error:", err);
    return new Response("Server error", { status: 500 });
  }
}
