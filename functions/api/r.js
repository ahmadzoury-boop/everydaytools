// /functions/api/r.js
import { ensureTables } from "../../../utils/digest-lib.js";

export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const kind = url.searchParams.get("kind") || "daily";
  const dateKey = url.searchParams.get("date") || "";
  const linkKey = url.searchParams.get("link") || "dashboard";

  const targets = {
    dashboard: env.RATES_DASH_URL || `${env.PUBLIC_URL || ""}/tools`,
    eur: "https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=EUR",
    gbp: "https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=GBP",
    try: "https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=TRY",
    aed: "https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=AED"
  };

  const target = targets[linkKey] || targets.dashboard;

  try {
    if (email && env.DIGEST_DB) {
      await ensureTables(env.DIGEST_DB);

      const now = new Date().toISOString();
      await env.DIGEST_DB
        .prepare(
          `INSERT INTO clicks (email, kind, date_key, link_key, target_url, clicked_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          email,
          kind,
          dateKey || now.slice(0, 10),
          linkKey,
          target,
          now
        )
        .run();
    }
  } catch (err) {
    console.error("click tracker error:", err);
  }

  return Response.redirect(target, 302);
}