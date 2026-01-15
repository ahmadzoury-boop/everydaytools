export async function onRequest({ env }) {
  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ error: "DB binding missing" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // IMPORTANT: match the real schema
    const query = `
      SELECT 
        name,
        score,
        date
      FROM brain_scores
      ORDER BY score DESC, created_at ASC
      LIMIT 50
    `;

    const { results } = await env.DB.prepare(query).all();

    return new Response(
      JSON.stringify({
        ok: true,
        count: results.length,
        rows: results
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
