// /digest-worker.js
import { Resend } from "resend";
import {
  todayKeyUTC,
  getOrCreateDailyRates,
  getHistory,
  getActiveSubscribers
} from "./utils/digest-lib.js";
import { generateMiniChart } from "./utils/chart.js";

export default {
  async scheduled(event, env, ctx) {
    const resend = new Resend(env.RESEND_API_KEY);
    const dateKey = todayKeyUTC();

    // Prepare data once
    const todayRates = await getOrCreateDailyRates(env, dateKey);
    const history = await getHistory(env, dateKey, 7);
    const chartDataUrl = await generateMiniChart(history);

    const subscribers = await getActiveSubscribers(env);
    if (!subscribers.length) {
      console.log("No active subscribers, skipping digest.");
      return;
    }

    const dailyTemplate = await fetch(
      `${env.PUBLIC_URL}/templates/daily.html`
    ).then((r) => r.text());
    const weeklyTemplate = await fetch(
      `${env.PUBLIC_URL}/templates/weekly.html`
    ).then((r) => r.text());

    if (event.cron === "0 6 * * *") {
      // DAILY
      for (const row of subscribers) {
        const email = row.email;
        const html = renderHtml({
          template: dailyTemplate,
          type: "daily",
          env,
          email,
          dateKey,
          todayRates,
          chartDataUrl
        });

        ctx.waitUntil(
          resend.emails.send({
            from: "Digest <digest@everydaytools.uk>",
            to: email,
            subject: `Daily Rate Digest – ${dateKey}`,
            html
          })
        );
      }
    }

    if (event.cron === "0 7 * * 0") {
      // WEEKLY (same data window, just different subject/template)
      for (const row of subscribers) {
        const email = row.email;
        const html = renderHtml({
          template: weeklyTemplate,
          type: "weekly",
          env,
          email,
          dateKey,
          todayRates,
          chartDataUrl
        });

        ctx.waitUntil(
          resend.emails.send({
            from: "Digest <digest@everydaytools.uk>",
            to: email,
            subject: `Weekly Rate Digest – Week ending ${dateKey}`,
            html
          })
        );
      }
    }
  }
};

function renderHtml({
  template,
  type,
  env,
  email,
  dateKey,
  todayRates,
  chartDataUrl
}) {
  const unsubUrl = `${env.PUBLIC_URL}/functions/api/unsubscribe?email=${encodeURIComponent(
    email
  )}`;

  const openPixelUrl = `${env.PUBLIC_URL}/functions/api/open-pixel?email=${encodeURIComponent(
    email
  )}&kind=${type}&date=${dateKey}`;

  const dashboardUrl = `${env.PUBLIC_URL}/functions/api/r?email=${encodeURIComponent(
    email
  )}&kind=${type}&date=${dateKey}&link=dashboard`;

  return template
    .replace(/{{DATE}}/g, dateKey)
    .replace(/{{USD_EUR}}/g, todayRates.usd_eur.toFixed(3))
    .replace(/{{USD_GBP}}/g, todayRates.usd_gbp.toFixed(3))
    .replace(/{{USD_TRY}}/g, todayRates.usd_try.toFixed(2))
    .replace(/{{USD_AED}}/g, todayRates.usd_aed.toFixed(2))
    .replace(/{{CHART_DATA}}/g, chartDataUrl)
    .replace(/{{UNSUB_URL}}/g, unsubUrl)
    .replace(/{{OPEN_PIXEL_URL}}/g, openPixelUrl)
    .replace(/{{DASHBOARD_URL}}/g, dashboardUrl);
}