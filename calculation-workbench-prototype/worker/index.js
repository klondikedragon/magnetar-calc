const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function cacheControlFor(pathname) {
  if (pathname === "/service-worker.js") return "no-cache, no-store, must-revalidate";
  if (pathname === "/manifest.webmanifest" || pathname === "/index.html" || pathname === "/") return "no-cache";
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/icons/")) return "public, max-age=86400, must-revalidate";
  return "no-cache";
}

function withResponseHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value));
  headers.set("Cache-Control", cacheControlFor(pathname));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    const requestUrl = new URL(request.url);

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return withResponseHeaders(response, requestUrl.pathname);
    }

    const indexUrl = new URL(requestUrl);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return withResponseHeaders(await env.ASSETS.fetch(new Request(indexUrl, request)), indexUrl.pathname);
  },
};
