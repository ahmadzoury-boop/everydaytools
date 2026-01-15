import { ok, bad, readJson, options, isoNow, normEmail, isEmail } from "./_shared.js";

export function onRequestOptions() { return options(); }

export async function onRequest({ request, env }) {
  const { email } = await readJson(request);
  const e = normEmail(email);
  if (!isEmail(e)) return bad("Invalid email");

  await env.DB.prepare(
    `UPDATE subscribers SET status='unsubscribed', unsubscribed_at=? WHERE email=?`
  ).bind(isoNow(), e).run();

  return ok({ message: "Unsubscribed", email: e });
}
