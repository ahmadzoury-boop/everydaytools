export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { date, score, name, device_hash } = body;

    // Basic validation
    if (
      !date ||
      typeof score !== "number" ||
      score < 0 ||
      score > 30 ||
      !device_hash
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400 }
      );
    }

    const displayName =
      typeof name === "string" && name.trim()
        ? name.trim().slice(0, 32)
        : "Anonymous";

    await env.DB.prepare(
      `
      INSERT INTO brain_scores (date, score, name, device_hash)
      VALUES (?, ?, ?, ?)
      `
    )
      .bind(date, score, displayName, device_hash)
      .run();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );

  } catch (err) {
    // Duplicate submission
    if (String(err).includes("UNIQUE")) {
      return new Response(
        JSON.stringify({ error: "Score already submitted today" }),
        { status: 409 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500 }
    );
  }
}
