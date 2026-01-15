export async function onRequest({ env }) {
  const day = new Date().toISOString().slice(0, 10);

  try {
    const { results } = await env.DB
      .prepare(
        `SELECT name, score
         FROM brain_scores
         WHERE day = ?
         ORDER BY score DESC
         LIMIT 20`
      )
      .bind(day)
      .all();

    return new Response(
      JSON.stringify({
        ok: true,
        day,
        rows: results || []
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
