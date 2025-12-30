export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const from = url.searchParams.get("from") || "USD";
    const to = url.searchParams.get("to") || "EUR";
    const amount = parseFloat(url.searchParams.get("amount") || "1");

    const apiUrl = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.rates || !data.rates[to]) {
      return new Response(JSON.stringify({ error: "Invalid currency pair" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const rate = data.rates[to];
    const result = amount * rate;

    return new Response(
      JSON.stringify({
        from,
        to,
        amount,
        rate,
        result: Number(result.toFixed(6))
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
