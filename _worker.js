export default {
  async fetch(request, env) {

    const url = new URL(request.url)

    if (url.pathname.startsWith("/currency/")) {

      url.pathname = "/currency/index.html"
      return fetch(url.toString(), request)

    }

    return fetch(request)
  }
}