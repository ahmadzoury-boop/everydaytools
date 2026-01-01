export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;
est(context) {
export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;
 context;
export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;
st.json();
export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;
;
export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;
ON.stringify({ success: false, error: "Email is required" }), {
export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;
Type": "application/json" }
export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // ⭐ STEP 1 — Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "POST only" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⭐ STEP 2 — Safely parse JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const email = data.email;

    await env.SUBSCRIBERS.put(email, JSON.stringify({ email, subscribedAt: Date.now() }));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
