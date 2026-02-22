// /utils/digest-lib.js

export function todayKeyUTC() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Make sure tables exist (safe to call often)
export async function ensureTables(db) {
  if (!db) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      unsubscribed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS daily_rates (
      date_key TEXT PRIMARY KEY,
      usd_eur REAL,
      usd_gbp REAL,
      usd_try REAL,
      usd_aed REAL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS opens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      kind TEXT NOT NULL,
      date_key TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      user_agent TEXT
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      kind TEXT NOT NULL,
      date_key TEXT NOT NULL,
      link_key TEXT NOT NULL,
      target_url TEXT NOT NULL,
      clicked_at TEXT NOT NULL
    );
  `);
}

// --- Subscribers ---

export async function getActiveSubscribers(env) {
  if (!env.DIGEST_DB) return [];
  const { results } = await env.DIGEST_DB
    .prepare(
      `SELECT email
       FROM subscribers
       WHERE unsubscribed_at IS NULL`
    )
    .all();
  return results || [];
}

export async function upsertSubscriber(env, email) {
  const now = new Date().toISOString();
  await ensureTables(env.DIGEST_DB);
  await env.DIGEST_DB
    .prepare(
      `INSERT INTO subscribers (email, created_at, unsubscribed_at)
       VALUES (?, ?, NULL)
       ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL`
    )
    .bind(email, now)
    .run();
}

export async function unsubscribeByEmail(env, email) {
  const now = new Date().toISOString();
  await ensureTables(env.DIGEST_DB);
  await env.DIGEST_DB
    .prepare(
      `UPDATE subscribers
       SET unsubscribed_at = ?
       WHERE email = ?`
    )
    .bind(now, email)
    .run();
}

// --- Rates + history ---

const FALLBACK_RATES = {
  usd_eur: 0.92,
  usd_gbp: 0.79,
  usd_try: 30.5,
  usd_aed: 3.67
};

export async function fetchLiveRates(env) {
  const url =
    env.RATES_API_URL ||
    "https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP,TRY,AED";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Bad response");
    const data = await res.json();
    const rates = data.rates || data.result || data.data || {};

    const usd_eur = Number(rates.EUR ?? rates.usd_eur);
    const usd_gbp = Number(rates.GBP ?? rates.usd_gbp);
    const usd_try = Number(rates.TRY ?? rates.usd_try);
    const usd_aed = Number(rates.AED ?? rates.usd_aed ?? 3.67);

    if (!usd_eur || !usd_gbp || !usd_try) throw new Error("Missing fields");

    return { usd_eur, usd_gbp, usd_try, usd_aed };
  } catch (err) {
    console.log("Live FX failed, using fallback:", err);
    return { ...FALLBACK_RATES };
  }
}

export async function getOrCreateDailyRates(env, dateKey) {
  await ensureTables(env.DIGEST_DB);
  if (!env.DIGEST_DB) {
    return { date_key: dateKey, ...FALLBACK_RATES };
  }

  let row = await env.DIGEST_DB
    .prepare(
      `SELECT date_key, usd_eur, usd_gbp, usd_try, usd_aed
       FROM daily_rates
       WHERE date_key = ?`
    )
    .bind(dateKey)
    .first();

  if (!row) {
    const live = await fetchLiveRates(env);
    const now = new Date().toISOString();
    await env.DIGEST_DB
      .prepare(
        `INSERT INTO daily_rates
         (date_key, usd_eur, usd_gbp, usd_try, usd_aed, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        dateKey,
        live.usd_eur,
        live.usd_gbp,
        live.usd_try,
        live.usd_aed,
        now
      )
      .run();

    row = { date_key: dateKey, ...live };
  }

  return row;
}

export async function getHistory(env, uptoDateKey, days) {
  if (!env.DIGEST_DB) {
    // simple mock history
    const vals = [];
    for (let i = days - 1; i >= 0; i--) {
      vals.push(FALLBACK_RATES.usd_eur + (Math.random() - 0.5) * 0.02);
    }
    return vals;
  }

  await ensureTables(env.DIGEST_DB);

  const { results } = await env.DIGEST_DB
    .prepare(
      `SELECT date_key, usd_eur
       FROM daily_rates
       WHERE date_key <= ?
       ORDER BY date_key DESC
       LIMIT ?`
    )
    .bind(uptoDateKey, days)
    .all();

  const rows = (results || []).reverse(); // oldest first
  if (!rows.length) {
    // fallback if DB empty
    const vals = [];
    for (let i = days - 1; i >= 0; i--) {
      vals.push(FALLBACK_RATES.usd_eur + (Math.random() - 0.5) * 0.02);
    }
    return vals;
  }

  return rows.map((r) => Number(r.usd_eur));
}

// Admin stats
export async function getAdminStats(env) {
  await ensureTables(env.DIGEST_DB);
  if (!env.DIGEST_DB) {
    return {
      totalSubscribers: 0,
      activeSubscribers: 0,
      unsubscribed: 0,
      opens: [],
      clicks: []
    };
  }

  const [{ totalSubscribers }] = (
    await env.DIGEST_DB
      .prepare("SELECT COUNT(*) AS totalSubscribers FROM subscribers")
      .all()
  ).results;
  const [{ activeSubscribers }] = (
    await env.DIGEST_DB
      .prepare(
        "SELECT COUNT(*) AS activeSubscribers FROM subscribers WHERE unsubscribed_at IS NULL"
      )
      .all()
  ).results;
  const [{ unsubscribed }] = (
    await env.DIGEST_DB
      .prepare(
        "SELECT COUNT(*) AS unsubscribed FROM subscribers WHERE unsubscribed_at IS NOT NULL"
      )
      .all()
  ).results;

  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const opens = (
    await env.DIGEST_DB
      .prepare(
        `SELECT date_key, kind, COUNT(*) AS count
         FROM opens
         WHERE date_key >= ?
         GROUP BY date_key, kind
         ORDER BY date_key ASC`
      )
      .bind(sevenDaysAgo)
      .all()
  ).results;

  const clicks = (
    await env.DIGEST_DB
      .prepare(
        `SELECT date_key, kind, link_key, COUNT(*) AS count
         FROM clicks
         WHERE date_key >= ?
         GROUP BY date_key, kind, link_key
         ORDER BY date_key ASC`
      )
      .bind(sevenDaysAgo)
      .all()
  ).results;

  return {
    totalSubscribers,
    activeSubscribers,
    unsubscribed,
    opens,
    clicks
  };
}