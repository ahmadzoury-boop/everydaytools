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

    const name = body.name || "Player";
    const score = Number(body.score) || 0;
    const day = body.day || new Date().toISOString().slice(0, 10);

    // 🔑 REQUIRED FIELD
    const device_hash =
      body.device_hash ||
      crypto.randomUUID(); // fallback for safety

    await env.DB.prepare(`
      INSERT INTO brain_scores (name, score, date, device_hash)
      VALUES (?, ?, ?, ?)
    `).bind(name, score, day, device_hash).run();

    return new Response(
      JSON.stringify({
        ok: true,
        saved: { name, score, day, device_hash }
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
