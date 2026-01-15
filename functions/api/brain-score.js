export async function onRequest({ request, env }) {
  try {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!env.DB) {
      return new Response(
        JSON.stringify({ error: "DB binding missing" }),
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      name = "Player",
      score = 0,
      day = new Date().toISOString().slice(0, 10),
    } = body;

    await env.DB.prepare(`
      INSERT INTO brain_scores (name, score, date)
      VALUES (?, ?, ?)
    `).bind(name, score, day).run();

    return new Response(
      JSON.stringify({
        ok: true,
        saved: { name, score, day }
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message
      }),
      { status: 500 }
    );
  }
}
