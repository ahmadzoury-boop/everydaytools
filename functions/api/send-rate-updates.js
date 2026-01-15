// Cloudflare Scheduled Worker — Daily Currency Rate Emails

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyEmails(env));
  },
};

async function runDailyEmails(env) {
  if (!env.SUBSCRIBERS || !env.RESEND_API_KEY) {
    console.error("Missing SUBSCRIBERS KV or RESEND_API_KEY");
    return;
  }

  console.log("⏰ Running scheduled rate updates...");

  const list = await listSubscribers(env.SUBSCRIBERS);
  if (!list.length) {
    console.log("No subscribers found.");
    return;
  }

  for (const sub of list) {
    if (sub.frequency !== "daily") continue; // send only daily updates for now

    try {
      const snapshot = await getRateSnapshot(sub.from, sub.to);
      const unsubscribeUrl = `https://everydaytools.uk/api/unsubscribe?email=${encodeURIComponent(
        sub.email
      )}`;
      const subject = `💱 ${sub.from} → ${sub.to}: ${snapshot.rate}`;

      const html = `
        <h2>Daily Exchange Rate Update</h2>
        <p><b>${sub.from} → ${sub.to}</b></p>
        <p><b>1 ${sub.from} = ${snapshot.rate} ${sub.to}</b></p>
        <p>Change vs last day: ${
          snapshot.changePct >= 0 ? "▲" : "▼"
        } ${snapshot.changePct.toFixed(2)}%</p>
        <p style="font-size:12px;color:#6b7280">As of ${snapshot.asOf}</p>
        <hr/>
        <p style="font-size:12px;color:#6b7280">
          Don’t want these? <a href="${unsubscribeUrl}">Unsubscribe</a>
        </p>
      `;

      const text = `Daily Exchange Rate Update:
${sub.from} → ${sub.to}
1 ${sub.from} = ${snapshot.rate} ${sub.to}
Change vs last day: ${snapshot.changePct >= 0 ? "+" : ""}${snapshot.changePct.toFixed(
        2
      )}%
As of ${snapshot.asOf}
Unsubscribe: ${unsubscribeUrl}`;

      await sendEmail(env.RESEND_API_KEY, sub.email, subject, html, text);
      console.log(`✅ Sent to ${sub.email}`);
    } catch (err) {
      console.error(`❌ Failed for ${sub.email}`, err);
    }
  }
}

// ---------------------- helpers ----------------------

async function listSubscribers(KV) {
  const list = [];
  let cursor;
  do {
    const res = await KV.list({ cursor });
    for (const key of res.keys) {
      const item = await KV.get(key.name, { type: "json" });
      if (item) list.push(item);
    }
    cursor = res.cursor;
  } while (cursor);
  return list;
}

async function getRateSnapshot(from, to) {
  const latestUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(
    from
  )}&to=${encodeURIComponent(to)}`;
  const res = await fetch(latestUrl);
  const data = await res.json();
  const rate = data.rates?.[to] || null;
  const asOf = data.date;

  // simple day-over-day change
  const today = new Date(asOf);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yestStr = yesterday.toISOString().split("T")[0];
  const prevRes = await fetch(
    `https://api.frankfurter.app/${yestStr}?from=${from}&to=${to}`
  );
  const prev = await prevRes.json();
  const prevRate = prev.rates?.[to] || rate;
  const changePct = ((rate - prevRate) / prevRate) * 100;

  return { rate: rate?.toFixed(6), changePct, asOf };
}

async function sendEmail(apiKey, to, subject, html, text) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Everyday Tools <noreply@everydaytools.uk>",
      to,
      subject,
      html,
      text,
      headers: {
        "Reply-To": "support@everydaytools.uk",
        "List-Unsubscribe": `<https://everydaytools.uk/api/unsubscribe?email=${encodeURIComponent(
          to
        )}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
}
