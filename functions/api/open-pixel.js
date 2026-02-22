// /functions/api/open-pixel.js
import { ensureTables } from "../../../utils/digest-lib.js";

const PIXEL_BASE64 =
  "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="; // 1x1 transparent GIF

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const kind = url.searchParams.get("kind") || "daily";
  const dateKey = url.searchParams.get("date") || "";

  try {
    if (email && env.DIGEST_DB) {
      await ensureTables(env.DIGEST_DB);
      const now = new Date().toISOString();
      const ua = request.headers.get("user-agent") || "";

      await env.DIGEST_DB
        .prepare(
          `INSERT INTO opens (email, kind, date_key, opened_at, user_agent)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(email, kind, dateKey || now.slice(0, 10), now, ua)
        .run();
    }
  } catch (err) {
    console.error("open-pixel error:", err);
  }

  const binary = Uint8Array.from(atob(PIXEL_BASE64), (c) =>
    c.charCodeAt(0)
  );

  return new Response(binary, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}