// /functions/api/admin-digest.js
import { getAdminStats } from "../../../utils/digest-lib.js";

export async function onRequest(context) {
  const { env } = context;
  try {
    const stats = await getAdminStats(env);
    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("admin-digest error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}