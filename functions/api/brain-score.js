const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}

const ALLOWED_LEVELS = ["easy", "medium", "hard"];

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);

    // =========================
    // POST → submit brain score
    // =========================
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Invalid JSON",
          }),
          { status: 400, headers }
        );
      }

      let { name, score, level } = body;

      // ---- Validation ----
      if (typeof score !== "number" || score < 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid score" }),
          { status: 400, headers }
        );
      }

      level = ALLOWED_LEVELS.includes(level) ? level : "easy";

      name = String(name || "Anonymous")
        .trim()
        .slice(0, 24);

      // ---- Insert ----
      await env.DB.prepare(
        `
        INSERT INTO brain_scores (name, score, level)
        VALUES (?, ?, ?)
        `
      )
        .bind(name, score, level)
        .run();

      return new Response(
        JSON.stringify({ ok: true, message: "Score saved" }),
        { headers }
      );
    }

    // =========================
    // GET → global leaderboard
    // =========================
    const level = ALLOWED_LEVELS.includes(url.searchParams.get("level"))
      ? url.searchParams.get("level")
      : "easy";

    // ⚠️ IMPORTANT: LIMIT must be injected, not bound
    const limitRaw = Number(url.searchParams.get("limit")) || 20;
    const limit = Math.min(Math.max(limitRaw, 1), 50);

    const result = await env.DB.prepare(
      `
      SELECT name, score, created_at
      FROM brain_scores
      WHERE level = ?
      ORDER BY score DESC, created_at ASC
      LIMIT ${limit}
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
