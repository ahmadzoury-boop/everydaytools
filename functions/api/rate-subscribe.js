export async function onRequest(context) {
  try {
    const { request, env } = context;

    // Allow only POST
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "POST only" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Parse JSON safely
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const email = data.email;
    const frequency = data.frequency;
    const from = data.from;
    const to = data.to;

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Store in KV
    await env.SUBSCRIBERS.put(
      email,
      JSON.stringify({
        email,
        frequency,
        from,
        to,
        subscribedAt: Date.now()
      })
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
