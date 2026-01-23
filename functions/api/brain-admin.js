const DATA_URL =
  "https://everydaytools.uk/tools/brain/data/sets-2026-01-12_to_2026-02-10.json";

// ----------------- Key check helper -----------------
function checkAdminKey(env, url) {
  const key = url.searchParams.get("key");
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

// Simple date helpers reused
function todayKeyUTC() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getWeeklyWindow(now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

// Mail sender (MailChannels)
async function sendMail(to, subject, html) {
  const payload = {
    personalizations: [
      {
        to: [{ email: to }],
        from: {
          email: "no-reply@everydaytools.uk",
          name: "EverydayTools — Daily Brain",
        },
        subject,
      },
    ],
    content: [{ type: "text/html", value: html }],
  };

  await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ====================================================
// GET  /api/brain-admin?key=ADMIN_KEY
//   → dashboard data (subs, today, weekly, time series)
// ====================================================
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const unauthorized = checkAdminKey(env, url);
  if (unauthorized) return unauthorized;

  // ----- Subscribers -----
  const subs = await env.DB.prepare(
    `SELECT email, daily_enabled, weekly_enabled, created_at, status
     FROM subscribers
     ORDER BY created_at DESC`
  ).all();

  // ----- Today scores -----
  const today = todayKeyUTC();
  const todayScores = await env.DB.prepare(
    `SELECT email, score, created_at
     FROM brain_scores
     WHERE created_at LIKE ?`
  )
    .bind(`${today}%`)
    .all();

  // ----- Weekly scores + stats -----
  const { startIso, endIso } = getWeeklyWindow();

  const weekly = await env.DB.prepare(
    `SELECT email,
            SUM(score) AS total_score,
            COUNT(*) AS days_played,
            MAX(created_at) AS last_played
     FROM brain_scores
     WHERE created_at >= ? AND created_at < ?
     GROUP BY email
     ORDER BY total_score DESC`
  )
    .bind(startIso, endIso)
    .all();

  const rows = weekly.results || [];
  const totalPlayers = rows.length;
  const avgScore = totalPlayers
    ? Math.round(rows.reduce((a, r) => a + r.total_score, 0) / totalPlayers)
    : 0;
  const highestScore = totalPlayers ? rows[0].total_score : 0;

  // ----- Time series for charts (last 14 days active players) -----
  const now = new Date();
  const start14 = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 13
    )
  );
  const start14Iso = start14.toISOString().slice(0, 10);

  const activity = await env.DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day,
            COUNT(DISTINCT email) AS players
     FROM brain_scores
     WHERE created_at >= ?
     GROUP BY day
     ORDER BY day`
  )
    .bind(start14Iso)
    .all();

  const subsSeries = await env.DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day,
            COUNT(*) AS subs
     FROM subscribers
     GROUP BY day
     ORDER BY day`
  ).all();

  return Response.json({
    subscribers: subs.results || [],
    todayScores: todayScores.results || [],
    weeklyScores: rows,
    weeklyStats: {
      totalPlayers,
      avgScore,
      highestScore,
    },
    timeSeries: {
      activity: activity.results || [],
      subscribers: subsSeries.results || [],
    },
  });
}

// ====================================================
// POST /api/brain-admin?key=ADMIN_KEY
//   action = "deleteSubscriber" | "sendTestEmail"
// ====================================================
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const unauthorized = checkAdminKey(env, url);
  if (unauthorized) return unauthorized;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = body.action;

  // ---------- Delete subscriber ----------
  if (action === "deleteSubscriber") {
    const email = (body.email || "").trim();
    if (!email) {
      return Response.json({ ok: false, error: "Email required" }, { status: 400 });
    }

    await env.DB.prepare("DELETE FROM subscribers WHERE email = ?")
      .bind(email)
      .run();
    await env.DB.prepare("DELETE FROM brain_scores WHERE email = ?")
      .bind(email)
      .run();

    return Response.json({ ok: true });
  }

  // ---------- Send test email ----------
  if (action === "sendTestEmail") {
    const email = (body.email || "").trim();
    if (!email) {
      return Response.json({ ok: false, error: "Email required" }, { status: 400 });
    }

    const html = `
      <h2>EverydayTools — Daily Brain (Test)</h2>
      <p>This is a test email sent from the Brain Admin Dashboard.</p>
      <p>If you received this, MailChannels + ADMIN_KEY are working correctly.</p>
      <p><a href="https://everydaytools.uk/tools/brain">Open Daily Brain</a></p>
    `;
    await sendMail(email, "Test email from Brain Admin", html);

    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
