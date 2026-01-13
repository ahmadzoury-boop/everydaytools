export async function onRequest({ env }) {
  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "DB binding is missing",
          envKeys: Object.keys(env),
        }),
        { status: 500 }
      );
    }

    const test = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();

    return new Response(
      JSON.stringify({
        ok: true,
        message: "D1 connected successfully",
        tables: test.results,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message,
        stack: err.stack,
      }),
      { status: 500 }
    );
  }
}
