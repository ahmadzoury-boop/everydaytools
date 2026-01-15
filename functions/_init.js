export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // ✅ Allow API routes to pass through untouched
  if (url.pathname.startsWith("/api/")) {
    return await next();
  }

  // ✅ Allow everything else (pages, assets)
  return await next();
}
