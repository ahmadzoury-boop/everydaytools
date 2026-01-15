export async function onRequest(context) {
  return new Response(
    JSON.stringify({
      ok: true,
      route: "brain-leaderboard",
      envKeys: Object.keys(context.env || {})
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
