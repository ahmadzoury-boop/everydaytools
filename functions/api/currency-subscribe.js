export async function onRequest(context) {

  const { request } = context;

  let email = "";

  try {
    const ct = request.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      const body = await request.json();
      email = (body.email || "").trim().toLowerCase();
    } 
    else if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      email = (form.get("email") || "").toString().trim().toLowerCase();
    }
  } catch {}

  if (!email) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Missing email"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const workerResponse = await fetch(
    "https://currency-digest.ahmadzoury.workers.dev/subscribe",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        pair: "USD/EUR",
        daily_enabled: true,
        weekly_enabled: false
      })
    }
  );

  const text = await workerResponse.text();

  return new Response(text, {
    headers: { "Content-Type": "application/json" }
  });
}