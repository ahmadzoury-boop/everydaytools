import {
  ok,
  bad,
  readJson,
  options,
  isoNow,
  todayUTC
} from "./_shared.js";

export function onRequestOptions() {
  return options();
}

export async function onRequest({ request, env }) {
  const body = await readJson(request);

  const day = String(body.day || todayUTC()).slice(0, 10);
  const name = String(body.name || "Player").trim().slice(0, 30);
  const score = Number(body.score);

  if (!Number.isFinite(score) || score < 0 || score > 60) {
    return bad("Invalid score");
  }

  const bestRun =
    body.bestRun ? JSON.stringify(body.bestRun).slice(0, 500) : null;

  await env.DB.prepare(
    `INSERT INTO brain_scores
     (day, name, score, best_run, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(day, name, score, bestRun, isoNow())
    .run();

  return ok({ message: "Score saved", day, score });
}
