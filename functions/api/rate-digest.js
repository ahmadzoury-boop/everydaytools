export async function onRequest(context) {
  const { request, env } = context;

  const type = new URL(request.url).searchParams.get("type") || "daily";

  const mockData = generateMockRates();

  // Load template
  const templatePath =
    type === "weekly"
      ? "/templates/weekly.html"
      : "/templates/daily.html";

  const template = await env.ASSETS.fetch(templatePath).then((r) => r.text());

  // Generate chart as Base64 PNG
  const chart = await generateMiniChart(mockData.history);

  // Insert data into template
  const html = template
    .replace("{{DATE}}", mockData.date)
    .replace("{{USD_EUR}}", mockData.rates.USD_EUR)
    .replace("{{USD_GBP}}", mockData.rates.USD_GBP)
    .replace("{{USD_TRY}}", mockData.rates.USD_TRY)
    .replace("{{USD_AED}}", mockData.rates.USD_AED)
    .replace("{{CHART_DATA}}", chart);

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}

// ---------- MOCK DATA ----------
function generateMockRates() {
  const today = new Date().toISOString().slice(0, 10);

  const base = {
    USD_EUR: (0.90 + Math.random() * 0.04).toFixed(3),
    USD_GBP: (0.77 + Math.random() * 0.04).toFixed(3),
    USD_TRY: (30.0 + Math.random() * 1.8).toFixed(2),
    USD_AED: 3.67
  };

  const history = Array.from({ length: 7 }).map(() => 0.90 + Math.random() * 0.05);

  return {
    date: today,
    rates: base,
    history
  };
}

// Import chart generator
import { generateMiniChart } from "../../utils/chart.js";