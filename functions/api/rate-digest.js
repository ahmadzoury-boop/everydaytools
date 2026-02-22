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

  const type = url.searchParams.get("type") === "weekly" ? "weekly" : "daily";
  const email =
    (url.searchParams.get("email") || "preview@example.com").trim().toLowerCase();

  const dateKey = todayKeyUTC();

  // Data
  const todayRates = await getOrCreateDailyRates(env, dateKey);
  const history = await getHistory(env, dateKey, 7); // EUR series

  const chartDataUrl = await generateMiniChart(history);

  const templatePath =
    type === "weekly" ? "/templates/weekly.html" : "/templates/daily.html";

  const template = await fetch(env.PUBLIC_URL + templatePath).then((r) =>
    r.text()
  );

  const unsubUrl = `${env.PUBLIC_URL}/functions/api/unsubscribe?email=${encodeURIComponent(
    email
  )}`;

  const openPixelUrl = `${env.PUBLIC_URL}/functions/api/open-pixel?email=${encodeURIComponent(
    email
  )}&kind=${type}&date=${dateKey}`;

  const dashboardUrl = `${env.PUBLIC_URL}/functions/api/r?email=${encodeURIComponent(
    email
  )}&kind=${type}&date=${dateKey}&link=dashboard`;

  const html = template
    .replace(/{{DATE}}/g, dateKey)
    .replace(/{{USD_EUR}}/g, todayRates.usd_eur.toFixed(3))
    .replace(/{{USD_GBP}}/g, todayRates.usd_gbp.toFixed(3))
    .replace(/{{USD_TRY}}/g, todayRates.usd_try.toFixed(2))
    .replace(/{{USD_AED}}/g, todayRates.usd_aed.toFixed(2))
    .replace(/{{CHART_DATA}}/g, chartDataUrl)
    .replace(/{{UNSUB_URL}}/g, unsubUrl)
    .replace(/{{OPEN_PIXEL_URL}}/g, openPixelUrl)
    .replace(/{{DASHBOARD_URL}}/g, dashboardUrl);

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}