// functions/api/rates.js

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function cleanCode(v) {
  return String(v || "").trim().toUpperCase();
}

function isCurrencyCode(v) {
  return /^[A-Z]{3}$/.test(v);
}

export async function onRequest({ request }) {
  try {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const reqUrl = new URL(request.url);
    const from = cleanCode(reqUrl.searchParams.get("from") || "USD");
    const to = cleanCode(reqUrl.searchParams.get("to") || "EUR");
    const amount = Number(reqUrl.searchParams.get("amount") || "1");

    if (!isCurrencyCode(from) || !isCurrencyCode(to)) {
      return json({ error: "Invalid currency codes (use 3-letter codes like USD, EUR)." }, 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Invalid amount. Must be a number greater than 0." }, 400);
    }

    // Same currency shortcut
    if (from === to) {
      return json(
        {
          from,
          to,
          amount,
          rate: 1,
          result: Number(amount.toFixed(6)),
          source: "local",
          fetched_at: new Date().toISOString(),
        },
        200,
        { "Cache-Control": "public, max-age=60" }
      );
    }

    // --------
    // Cache rate per pair (amount should not affect caching)
    // --------
    const cache = caches.default;
    const cacheKeyUrl = new URL(request.url);
    cacheKeyUrl.pathname = "/__cache/rates";
    cacheKeyUrl.search = `?from=${from}&to=${to}`;
    const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

    const cached = await cache.match(cacheKey);
    if (cached) {
      const cachedData = await cached.json().catch(() => null);
      if (cachedData && typeof cachedData.rate === "number") {
        const rate = cachedData.rate;
        return json(
          {
            from,
            to,
            amount,
            rate,
            result: Number((amount * rate).toFixed(6)),
            source: cachedData.source || "cache",
            date: cachedData.date || null,
            fetched_at: cachedData.fetched_at || new Date().toISOString(),
          },
          200,
          { "Cache-Control": "public, max-age=60" }
        );
      }
    }

    // --------
    // Fetch rate from Frankfurter
    // --------
    const apiUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!res.ok) {
      return json({ error: "Failed to fetch currency rates" }, 502);
    }

    const data = await res.json().catch(() => null);
    const rate = data?.rates?.[to];

    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      return json({ error: "Invalid currency pair (rate not found)." }, 400);
    }

    // Save in cache (5 minutes)
    const payloadForCache = {
      rate,
      source: "frankfurter.app",
      date: data?.date || null,
      fetched_at: new Date().toISOString(),
    };

    await cache.put(
      cacheKey,
      new Response(JSON.stringify(payloadForCache), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      })
    );

    const result = amount * rate;

    return json(
      {
        from,
        to,
        amount,
        rate,
        result: Number(result.toFixed(6)),
        source: "frankfurter.app",
        date: data?.date || null,
        fetched_at: payloadForCache.fetched_at,
      },
      200,
      { "Cache-Control": "public, max-age=60" }
    );
  } catch (err) {
    return json({ error: "Server error", details: err?.message || String(err) }, 500);
  }
}
