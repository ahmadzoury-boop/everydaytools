// /functions/api/rate-digest.js
import {
  todayKeyUTC,
  getOrCreateDailyRates,
  getHistory
} from "../../../utils/digest-lib.js";
import { generateMiniChart } from "../../../utils/chart.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // daily (default) or weekly
  const typeParam = url.searchParams.get("type");
  const type = typeParam === "weekly" ? "weekly" : "daily";

  // preview email if none provided
  const emailParam = url.searchParams.get("email") || "preview@example.com";
  const email = emailParam.trim().toLowerCase();

  const dateKey = todayKeyUTC();

  // Get today’s rates + 7-day EUR history
  const todayRates = await getOrCreateDailyRates(env, dateKey);
  const history = await getHistory(env, dateKey, 7);
  const chartDataUrl = await generateMiniChart(history);

  // Pick HTML template
  const templatePath =
    type === "weekly" ? "/templates/weekly.html" : "/templates/daily.html";

  const templateRes = await fetch(`${env.PUBLIC_URL}${templatePath}`);
  const template = await templateRes.text();

  // Links (unsubscribe, open-pixel, dashboard redirect)
  const unsubUrl = `${env.PUBLIC_URL}/functions/api/currency-unsubscribe?email=${encodeURIComponent(
    email
  )}`;

  const openPixelUrl = `${env.PUBLIC_URL}/functions/api/open-pixel?email=${encodeURIComponent(
    email
  )}&kind=${type}&date=${dateKey}`;

  const dashboardUrl = `${env.PUBLIC_URL}/functions/api/r?email=${encodeURIComponent(
    email
  )}&kind=${type}&date=${dateKey}&link=dashboard`;

  // Fill placeholders
  let html = template
    .replace(/{{DATE}}/g, dateKey)
    .replace(/{{USD_EUR}}/g, Number(todayRates.usd_eur).toFixed(3))
    .replace(/{{USD_GBP}}/g, Number(todayRates.usd_gbp).toFixed(3))
    .replace(/{{USD_TRY}}/g, Number(todayRates.usd_try).toFixed(2))
    .replace(/{{USD_AED}}/g, Number(todayRates.usd_aed).toFixed(2))
    .replace(/{{CHART_DATA}}/g, chartDataUrl)
    .replace(/{{UNSUB_URL}}/g, unsubUrl)
    .replace(/{{OPEN_PIXEL_URL}}/g, openPixelUrl)
    .replace(/{{DASHBOARD_URL}}/g, dashboardUrl);

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}