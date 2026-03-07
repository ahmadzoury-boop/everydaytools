export default {
  async fetch(request) {

    const url = new URL(request.url)

    if (url.pathname.startsWith("/currency/")) {

      return fetch(new URL("/currency/index.html", request.url))

    }

    return fetch(request)
  }
}