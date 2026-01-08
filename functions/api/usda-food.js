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

function extractNutrients(food) {
  const map = {};
  const list = food.foodNutrients || [];
  const byName = (n) => n?.nutrientName?.toLowerCase() || "";

  for (const n of list) {
    const name = byName(n);
    const value = n.value;
    if (name.includes("energy") && name.includes("kcal")) map.calories = value;
    if (name === "protein") map.protein = value;
    if (name.includes("carbohydrate")) map.carbs = value;
    if (name === "total lipid (fat)") map.fat = value;
    if (name.includes("fiber")) map.fiber = value;
    if (name.includes("sugars")) map.sugars = value;
    if (name.includes("sodium")) map.sodium = value;
  }

  return map;
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
      return json({ ok: false, error: "USDA fetch failed", details: text.slice(0, 300) }, 502);
    }

    const data = await res.json();

    const nutrients = extractNutrients(data);

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
