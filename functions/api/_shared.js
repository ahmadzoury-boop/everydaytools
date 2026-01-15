export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function options() {
  return new Response(null, { status: 204, headers: cors });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function ok(data = {}) {
  return json({ ok: true, ...data });
}

export function bad(error, status = 400) {
  return json({ ok: false, error }, status);
}

export function isoNow() {
  return new Date().toISOString();
}

export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

export function isEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function readJson(req) {
  if (!req.headers.get("content-type")?.includes("application/json")) return {};
  try { return await req.json(); } catch { return {}; }
}
