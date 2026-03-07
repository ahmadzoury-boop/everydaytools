export async function onRequest(context) {

  const url = new URL(context.request.url)

  // always serve the currency page
  url.pathname = "/currency/index.html"

  return context.env.ASSETS.fetch(url.toString())

}