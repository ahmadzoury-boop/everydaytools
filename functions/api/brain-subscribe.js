export async function onRequest(context) {

  return new Response(
    JSON.stringify({
      message: "NEW FUNCTION RUNNING",
      time: new Date().toISOString()
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );

}