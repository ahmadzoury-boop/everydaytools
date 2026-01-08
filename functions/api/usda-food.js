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

// USDA nutrient IDs / numbers (stable)
const NUTRIENT = {
  calories: { ids: [1008], numbers: ["208"], unit: "kcal" },
  protein:  { ids: [1003], numbers: ["203"], unit: "g" },
  fat:      { ids: [1004], numbers: ["204"], unit: "g" },
  carbs:    { ids: [1005], numbers: ["205"], unit: "g" },
  fiber:    { ids: [1079], numbers: ["291"], unit: "g" },
  sugars:   { ids: [2000], numbers: ["269"], unit: "g" },
  sodium:   { ids: [1093], numbers: ["307"], unit: "mg" },
};

function asNumber(v) {
  return (typeof v === "number" && isFinite(v)) ? v : null;
}

function findAmount(foodNutrients, spec) {
  if (!Array.isArray(foodNutrients)) return null;

  for (const n of foodNutrients) {
    const nut = n.nutrient || {};
    const id = nut.id;
    const number = nut.number;

    const idMatch = spec.ids.includes(id);
    const numberMatch = spec.numbers.includes(number);

    if (idMatch || numberMatch) {
      // IMPORTANT: use ?? so 0 isn't lost
      const val = (n.amount ?? n.value ?? null);
      return asNumber(val);
    }
  }
  return null;
}

function pickLabelNutrients(labelNutrients = {}) {
  // labelNutrients is typically per serving
  const get = (key) => asNumber(labelNutrients?.[key]?.value);

  return {
    calories: get("calories"),
    protein: get("protein"),
    fat: get("fat"),
    carbs: get("carbohydrates"),
    fiber: get("fiber"),
    sugars: get("sugars"),
    sodium: get("sodium"),
  };
}

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const fdcId = (url.searchParams.get("fdcId") || "").trim();
    if (!fdcId) return json({ ok: false, error: "Missing fdcId" }, 400);
    if (!env.USDA_FDC_API_KEY) return json({ ok: false, error: "Missing USDA_FDC_API_KEY env var." }, 500);

    const endpoint = `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(
      fdcId
    )}?api_key=${encodeURIComponent(env.USDA_FDC_API_KEY)}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: "USDA food fetch failed", details: text.slice(0, 400) }, 502);
    }

    const food = await res.json();

    let basis = "per 100 g (typical for SR/Foundation)";
    let serving = null;
    let nutrients = {};

    // Branded foods often have labelNutrients (per serving)
    if (food.labelNutrients) {
      basis = "per serving (nutrition label)";
      serving =
        food.servingSize && food.servingSizeUnit
          ? { size: food.servingSize, unit: food.servingSizeUnit }
          : null;

      nutrients = pickLabelNutrients(food.labelNutrients);
    } else {
      // SR Legacy / Foundation / Survey etc
      const fn = food.foodNutrients || [];
      nutrients = {
        calories: findAmount(fn, NUTRIENT.calories),
        protein:  findAmount(fn, NUTRIENT.protein),
        fat:      findAmount(fn, NUTRIENT.fat),
        carbs:    findAmount(fn, NUTRIENT.carbs),
        fiber:    findAmount(fn, NUTRIENT.fiber),
        sugars:   findAmount(fn, NUTRIENT.sugars),
        sodium:   findAmount(fn, NUTRIENT.sodium),
      };
    }

    return json(
      {
        ok: true,
        fdcId: food.fdcId,
        description: food.description || "",
        dataType: food.dataType || "",
        brandName: food.brandName || "",
        brandOwner: food.brandOwner || "",
        basis,
        serving,
        nutrients,
      },
      200,
      { "Cache-Control": "public, max-age=600" } // 10 min
    );
  } catch (err) {
    return json({ ok: false, error: "Server error", details: String(err) }, 500);
  }
}
