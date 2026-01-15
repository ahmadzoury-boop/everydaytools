import { ok, options, todayUTC } from "./_shared.js";

export function onRequestOptions() { return options(); }

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const day = String(url.searchParams.get("date") || todayUTC()).slice(0, 10);
  const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

  const res = await env.DB.prepare(
    `SELECT name, score, created_at
     FROM brain_scores
     WHERE day=?
     ORDER BY score DESC, created_at ASC
     LIMIT ?`
  ).bind(day, limit).all();

  return ok({ day, rows: res.results || [] });
}
