export async function onRequestPost({ request }) {

  let body;

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({
      success:false,
      error:"Invalid JSON body"
    }),{
      headers:{ "Content-Type":"application/json" }
    });
  }

  const email = String(body.email || "").trim();
  const fromCode = String(body.from || "").trim().toUpperCase();
  const toCode = String(body.to || "").trim().toUpperCase();
  const frequency = String(body.frequency || "daily").toLowerCase();

  if (!email) {
    return new Response(JSON.stringify({
      success:false,
      error:"Missing email"
    }),{
      headers:{ "Content-Type":"application/json" }
    });
  }

  if (!fromCode || !toCode || fromCode === toCode) {
    return new Response(JSON.stringify({
      success:false,
      error:"Please choose two different currencies"
    }),{
      headers:{ "Content-Type":"application/json" }
    });
  }

  // Forward subscription to the working Worker
  const workerRes = await fetch(
    "https://currency-digest.ahmadzoury.workers.dev/subscribe",
    {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        email,
        pair:`${fromCode}/${toCode}`,
        daily_enabled: frequency !== "weekly",
        weekly_enabled: frequency === "weekly"
      })
    }
  );

  const text = await workerRes.text();

  return new Response(text,{
    headers:{ "Content-Type":"application/json" }
  });
}