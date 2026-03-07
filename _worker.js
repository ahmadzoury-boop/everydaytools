export default {
  async fetch(request) {

    const url = new URL(request.url)

    // Only rewrite if it's /currency/... but NOT the real file
    if (url.pathname.startsWith("/currency/") && url.pathname !== "/currency/index.html") {

      const newUrl = new URL(request.url)
      newUrl.pathname = "/currency/index.html"

      return fetch(newUrl)
    }

    // everything else loads normally
    return fetch(request)
  }
}