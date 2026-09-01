import { dispatchRoute } from "./routes.js";
import { json, recordServerFailure } from "./telemetry.js";
export { decodeCatalogCursor, encodeCatalogCursor } from "./catalog-cursor.js";
export { sanitizeTelemetryEvent } from "./telemetry.js";

function isApiPath(pathname = "") {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function timedResponse(response, label, startedAt, requestId, pathname) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  headers.set("server-timing", `${label};dur=${Date.now() - startedAt}`);
  if (isApiPath(pathname)) headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    try {
      if (url.protocol === "http:" || url.hostname === "www.kutno.ru") {
        url.protocol = "https:";
        url.hostname = "kutno.ru";
        return Response.redirect(url.toString(), 308);
      }

      const { label, response } = await dispatchRoute(request, env, ctx, requestId);
      if (response.status >= 500) recordServerFailure(env, ctx, requestId, request, response.status, Date.now() - startedAt);
      return timedResponse(response, label, startedAt, requestId, url.pathname);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "unknown");
      recordServerFailure(env, ctx, requestId, request, 500, Date.now() - startedAt, message);
      return json({ error: "Сервис временно недоступен", requestId }, 500, {
        "x-request-id": requestId,
        ...(isApiPath(url.pathname) ? { "x-robots-tag": "noindex, nofollow" } : {}),
      });
    }
  },
};
