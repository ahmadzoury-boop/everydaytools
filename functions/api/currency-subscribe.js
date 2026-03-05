export async function onRequest(context) {

  const { request } = context;

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();

  if (!email) {
    return new Response(JSON.stringify({
      ok:false,
      error:"Missing email"
    }),{
      headers:{ "Content-Type":"application/json" }
    });
  }

  const res = await fetch(
    "https://currency-digest.ahmadzoury.workers.dev/subscribe",
    {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        email,
        pair:"USD/EUR",
        daily_enabled:true,
        weekly_enabled:false
      })
    }
  );

  const data = await res.text();

  return new Response(data,{
    headers:{ "Content-Type":"application/json" }
  });
}