import { ok, bad, readJson, options, isoNow, normEmail, isEmail } from "./_shared.js";

export function onRequestOptions() { return options(); }

export async function onRequest({ request, env }) {
  const { email } = await readJson(request);
  const e = normEmail(email);
  if (!isEmail(e)) return bad("Invalid email");

  await env.DB.prepare(
    `INSERT INTO subscribers (email, status, created_at)
     VALUES (?, 'active', ?)
     ON CONFLICT(email) DO UPDATE SET status='active', unsubscribed_at=NULL`
  ).bind(e, isoNow()).run();

  return ok({ message: "Subscribed", email: e });
}
