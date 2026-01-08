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

function findNutrient(foodNutrients, keys) {
  if (!Array.isArray(foodNutrients)) return null;
  const match = foodNutrients.find((n) => {
    const name = (n.nutrient?.name || "").toLowerCase();
    const number = n.nutrient?.number;
    return keys.some((k) => name.includes(k) || number === k);
  });
  if (!match) return null;
  const amount = match.amount || match.value;
  return isFinite(amount) ? amount : null;
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

    let nutrients = {};
    // If Branded item → use labelNutrients
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
    }
    // Otherwise parse SR Legacy / Foundation
    else if (data.foodNutrients?.length) {
      const fn = data.foodNutrients;
      nutrients = {
        calories: findNutrient(fn, ["energy", "208"]),
        protein: findNutrient(fn, ["protein", "203"]),
        carbs: findNutrient(fn, ["carbohydrate", "205"]),
        fat: findNutrient(fn, ["fat", "204", "lipid"]),
        fiber: findNutrient(fn, ["fiber", "291"]),
        sugars: findNutrient(fn, ["sugar", "269"]),
        sodium: findNutrient(fn, ["sodium", "307"]),
      };
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
