// /functions/api/rate-digest.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const typeParam = url.searchParams.get("type");
  const type = typeParam === "weekly" ? "weekly" : "daily";

  const emailParam = url.searchParams.get("email") || "preview@example.com";
  const email = emailParam.trim().toLowerCase();

  const dateKey = new Date().toISOString().slice(0, 10);

  // Templates
  const templatePath = type === "weekly" ? "/templates/weekly.html" : "/templates/daily.html";
  const templateRes = await fetch(`${env.PUBLIC_URL}${templatePath}`);
  const template = await templateRes.text();

  // Basic placeholders (no chart, no DB rates)
  const unsubUrl = `${env.PUBLIC_URL}/functions/api/currency-unsubscribe?email=${encodeURIComponent(email)}`;
  const openPixelUrl = `${env.PUBLIC_URL}/functions/api/open-pixel?email=${encodeURIComponent(email)}&kind=${type}&date=${dateKey}`;
  const dashboardUrl = `${env.PUBLIC_URL}/functions/api/r?email=${encodeURIComponent(email)}&kind=${type}&date=${dateKey}&link=dashboard`;

  // Put dummy rates (email preview only)
  const todayRates = {
    usd_eur: 0.0,
    usd_gbp: 0.0,
    usd_try: 0.0,
    usd_aed: 0.0
  };

  let html = template
    .replace(/{{DATE}}/g, dateKey)
    .replace(/{{USD_EUR}}/g, Number(todayRates.usd_eur).toFixed(3))
    .replace(/{{USD_GBP}}/g, Number(todayRates.usd_gbp).toFixed(3))
    .replace(/{{USD_TRY}}/g, Number(todayRates.usd_try).toFixed(2))
    .replace(/{{USD_AED}}/g, Number(todayRates.usd_aed).toFixed(2))
    .replace(/{{CHART_DATA}}/g, "") // no chart
    .replace(/{{UNSUB_URL}}/g, unsubUrl)
    .replace(/{{OPEN_PIXEL_URL}}/g, openPixelUrl)
    .replace(/{{DASHBOARD_URL}}/g, dashboardUrl);

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}