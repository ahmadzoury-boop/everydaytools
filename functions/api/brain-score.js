export async function onRequest({ request, env }) {
  const body = await request.json();

  const day = new Date().toISOString().slice(0, 10);
  const name = String(body.name || "Player").slice(0, 30);
  const results = body.results || {}; 
  // results = { easy:{correct,attempts}, medium:{...}, hard:{...} }

  let score = 0;
  const summary = {};

  // Easy
  if (results.easy?.correct) {
    score += 10;
    summary.easy = "correct";
  } else {
    summary.easy = "wrong";
  }

  // Medium
  if (results.medium?.correct) {
    score += 20;
    summary.medium = "correct";
  } else {
    summary.medium = "wrong";
  }

  // Hard (locked unless easy+medium correct)
  if (results.easy?.correct && results.medium?.correct) {
    if (results.hard?.correct) {
      score += 30;
      summary.hard = "correct";
    } else {
      summary.hard = "wrong";
    }
  } else {
    summary.hard = "locked";
  }

  // Cap score
  score = Math.min(score, 60);

  // Save score (once per day)
  try {
    await env.DB.prepare(
      `INSERT INTO brain_scores (day, name, score, best_run, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        day,
        name,
        score,
        JSON.stringify(summary),
        new Date().toISOString()
      )
      .run();
  } catch {
    return new Response(JSON.stringify({
      ok: false,
      error: "Already submitted today"
    }), { status: 409 });
  }

  // Analytics
  await env.DB.prepare(
    `INSERT INTO brain_events (day, event, meta, created_at)
     VALUES (?, 'submit', ?, ?)`
  )
    .bind(day, JSON.stringify({ score }), new Date().toISOString())
    .run();

  return new Response(JSON.stringify({
    ok: true,
    score,
    summary
  }), { headers: { "Content-Type": "application/json" } });
}
