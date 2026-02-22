// /functions/api/currency-unsubscribe.js
import { unsubscribeByEmail } from "../../../utils/digest-lib.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  if (!email) {
    return new Response("Missing email.", { status: 400 });
  }

  await unsubscribeByEmail(env, email);

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Unsubscribed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; background:#f7f7f8; padding:40px; }
          .card { max-width:480px; margin:auto; background:#fff; padding:24px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.05); }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>You’ve been unsubscribed</h2>
          <p>${email} will no longer receive the Rate Digest.</p>
        </div>
      </body>
    </html>
  `;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}