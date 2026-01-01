export async function onRequest(context) {
  try {
    const { request, env } = context;

    const data = await request.json();
    const email = data.email;

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Store email in KV
    await env.SUBSCRIBERS.put(email, JSON.stringify({ email, subscribedAt: Date.now() }));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
