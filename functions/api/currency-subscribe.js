// /functions/api/subscribe.js
import { upsertSubscriber } from "../../../utils/digest-lib.js";

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const email = await extractEmail(request);
    if (!email) {
      return json({ ok: false, error: "Email is required" }, 400);
    }

    await upsertSubscriber(env, email);

    return json({ ok: true, email });
  } catch (err) {
    console.error("Subscribe error:", err);
    return json({ ok: false, error: "Internal error" }, 500);
  }
}

async function extractEmail(request) {
  const url = new URL(request.url);
  const qpEmail = url.searchParams.get("email");
  if (qpEmail) return qpEmail.trim().toLowerCase();

  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return (body.email || "").trim().toLowerCase();
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return (form.get("email") || "").toString().trim().toLowerCase();
  }
  return null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}