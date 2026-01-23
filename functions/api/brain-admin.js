export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key !== env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ------ Subscribers ------
  const subs = await env.DB.prepare(
    `SELECT email, daily_enabled, weekly_enabled, created_at, status
     FROM subscribers
     ORDER BY created_at DESC`
  ).all();

  // ------ Today Scores ------
  const today = new Date().toISOString().slice(0,10);
  const todayScores = await env.DB.prepare(
    `SELECT email, score
     FROM brain_scores
     WHERE created_at LIKE ?`
  ).bind(`${today}%`).all();

  // ------ Weekly Scores ------
  const { startIso, endIso } = getWeeklyWindow();

  const weekly = await env.DB.prepare(
    `SELECT email, SUM(score) as total_score, COUNT(*) as days_played
     FROM brain_scores
     WHERE created_at >= ? AND created_at < ?
     GROUP BY email
     ORDER BY total_score DESC`
  ).bind(startIso, endIso).all();

  // ------ Weekly Stats ------
  const rows = weekly.results || [];
  const totalPlayers = rows.length;
  const avgScore = totalPlayers
    ? Math.round(rows.reduce((a, r) => a + r.total_score, 0) / totalPlayers)
    : 0;
  const highestScore = totalPlayers ? rows[0].total_score : 0;

  return Response.json({
    subscribers: subs.results || [],
    todayScores: todayScores.results || [],
    weeklyScores: rows,
    weeklyStats: {
      totalPlayers,
      avgScore,
      highestScore
    }
  });
}


// =============================
// Shared: Weekly window function
// =============================
function getWeeklyWindow(now = new Date()) {
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}
