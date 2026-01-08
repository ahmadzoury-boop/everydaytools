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

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "12", 10), 25);

    if (!q || q.length < 2) {
      return json({ ok: false, error: "Query too short. Use at least 2 characters." }, 400);
    }

    if (!env.USDA_FDC_API_KEY) {
      return json({ ok: false, error: "Missing USDA_FDC_API_KEY env var." }, 500);
    }

    const endpoint = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      env.USDA_FDC_API_KEY
    )}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: q,
        pageSize,
        pageNumber: 1,
        // Optionally filter:
        // dataType: ["Foundation", "SR Legacy", "Branded", "Survey (FNDDS)"],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: "USDA search failed", details: text.slice(0, 400) }, 502);
    }

    const data = await res.json();

    const items = (data.foods || []).map((f) => ({
      fdcId: f.fdcId,
      description: f.description || "",
      dataType: f.dataType || "",
      brandName: f.brandName || "",
      brandOwner: f.brandOwner || "",
      servingSize: f.servingSize ?? null,
      servingSizeUnit: f.servingSizeUnit || "",
    }));

    return json(
      { ok: true, query: q, totalHits: data.totalHits || 0, items },
      200,
      { "Cache-Control": "public, max-age=300" } // 5 min
    );
  } catch (err) {
    return json({ ok: false, error: "Server error", details: String(err) }, 500);
  }
}
