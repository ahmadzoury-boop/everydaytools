const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);

    // =========================
    // POST → submit brain score
    // =========================
    if (request.method === "POST") {
      const body = await request.json();
      const { name, score, level } = body;

      if (!name || typeof score !== "number") {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid payload" }),
          { status: 400, headers }
        );
      }

      await env.DB.prepare(
        `
        INSERT INTO brain_scores (name, score, level)
        VALUES (?, ?, ?)
        `
      )
        .bind(name.trim(), score, level || "easy")
        .run();

      return new Response(
        JSON.stringify({ ok: true, message: "Score saved" }),
        { headers }
      );
    }

    // =========================
    // GET → leaderboard
    // =========================
    const level = url.searchParams.get("level") || "easy";

    const result = await env.DB.prepare(
      `
      SELECT name, score, level, created_at
      FROM brain_scores
      WHERE level = ?
      ORDER BY score DESC
      LIMIT 20
      `
    )
      .bind(level)
      .all();

    return new Response(
      JSON.stringify({
        ok: true,
        level,
        leaderboard: result.results,
      }),
      { headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message,
      }),
      { status: 500, headers }
    );
  }
}
