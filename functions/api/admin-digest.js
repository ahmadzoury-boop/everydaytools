// /functions/api/admin-digest.js

export async function onRequest() {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "Admin digest disabled temporarily"
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}