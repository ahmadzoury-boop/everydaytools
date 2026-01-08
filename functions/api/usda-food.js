const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Map of nutrient IDs used by USDA (stable across data types)
const NUTRIENT_IDS = {
  calories: [1008, "208"],
  protein: [1003, "203"],
  fat: [1004, "204"],
  carbs: [1005, "205"],
  fiber: [1079, "291"],
  sugars: [2000, "269"],
  sodium: [1093, "307"],
};

function findAmount(list, ids) {
  for (const n of list) {
    const nut = n.nutrient || {};
    const id = nut.id;
    const number = nut.number;
    if (ids.includes(id) || ids.includes(number)) {
      return n.amount || n.value || null;
    }
  }
  return null;
}

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const fdcId = url.searchParams.get("fdcId");
    if (!fdcId) return json({ ok: false, error: "Missing fdcId" }, 400);
    if (!env.USDA_FDC_API_KEY)
      return json({ ok: false, error: "Missing USDA_FDC_API_KEY env var" }, 500);

    const endpoint = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(
      env.USDA_FDC_API_KEY
    )}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: "USDA fetch failed", details: text.slice(0, 400) }, 502);
    }

    const data = await res.json();

    let nutrients = {};

    // For branded foods, labelNutrients exists
    if (data.labelNutrients) {
      const ln = data.labelNutrients;
      nutrients = {
        calories: ln.calories?.value,
        protein: ln.protein?.value,
        carbs: ln.carbohydrates?.value,
        fat: ln.fat?.value,
        fiber: ln.fiber?.value,
        sugars: ln.sugars?.value,
        sodium: ln.sodium?.value,
      };
    } else if (Array.isArray(data.foodNutrients)) {
      // For SR Legacy and Foundation foods
      const fn = data.foodNutrients;
      nutrients = Object.fromEntries(
        Object.entries(NUTRIENT_IDS).map(([key, ids]) => [key, findAmount(fn, ids)])
      );
    }

    return json(
      {
        ok: true,
        fdcId: data.fdcId,
        description: data.description,
        dataType: data.dataType,
        brandName: data.brandName || "",
        brandOwner: data.brandOwner || "",
        nutrients,
      },
      200,
      { "Cache-Control": "public, max-age=600" }
    );
  } catch (err) {
    return json({ ok: false, error: "Server error", details: String(err) }, 500);
  }
}
