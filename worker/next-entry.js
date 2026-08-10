import matchingWorker from "./matching-entry.js";
import { serveCatalogIndex, serveCatalogPage, serveRecipeDetail } from "./catalog-page.js";
import { serveLitePage } from "./lite-page.js";
import { serveCrawlerRules, servePublicAppPage } from "./public-app-pages.js";
import { ensureFeatureStateTextSchema } from "./feature-state-migration.js";
import { serveFreshSitemap } from "./fresh-sitemap.js";
import { serveRecipeImage, serveRecipePhotoManifest } from "./recipe-images.js";
export { decodeCatalogCursor, encodeCatalogCursor } from "./catalog-cursor.js";

const MAX_TELEMETRY_EVENTS = 20;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanTelemetryData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => {
    const safeKey = cleanText(key, 60);
    if (typeof item === "number" || typeof item === "boolean") return [safeKey, item];
    if (Array.isArray(item)) return [safeKey, item.slice(0, 20).map((entry) => cleanText(entry, 120))];
    return [safeKey, cleanText(item, 500)];
  }).filter(([key]) => key));
}

export function sanitizeTelemetryEvent(value) {
  if (!value || typeof value !== "object") return null;
  const name = cleanText(value.name, 80);
  if (!name) return null;
  return {
    name,
    level: ["debug", "info", "warn", "error"].includes(value.level) ? value.level : "info",
    at: Math.max(0, Number(value.at) || Date.now()),
    path: cleanText(value.path, 200),
    data: cleanTelemetryData(value.data),
  };
}

async function ensureTelemetryTable(env) {
  if (!env.DB) return false;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    level TEXT NOT NULL,
    path TEXT NOT NULL,
    data_json TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    client_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS telemetry_created_at ON telemetry_events(created_at DESC)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS telemetry_event_name ON telemetry_events(event_name, created_at DESC)").run();
  return true;
}

async function saveTelemetry(request, env, requestId) {
  const contentLength = Number(request.headers.get("content-length")) || 0;
  if (contentLength > 64_000) return json({ error: "Слишком большой пакет событий" }, 413);
  const body = await request.json().catch(() => ({}));
  const sessionId = cleanText(body.sessionId, 120) || "anonymous";
  const events = (Array.isArray(body.events) ? body.events : []).slice(0, MAX_TELEMETRY_EVENTS).map(sanitizeTelemetryEvent).filter(Boolean);
  if (!events.length) return json({ ok: true, accepted: 0 }, 202, { "x-request-id": requestId });
  if (!await ensureTelemetryTable(env)) return json({ ok: true, accepted: 0, stored: false }, 202, { "x-request-id": requestId });
  const now = Date.now();
  const userAgent = cleanText(request.headers.get("user-agent"), 300);
  await env.DB.batch(events.map((event) => env.DB.prepare(`
    INSERT INTO telemetry_events (
      request_id, session_id, event_name, level, path, data_json, user_agent, client_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(requestId, sessionId, event.name, event.level, event.path, JSON.stringify(event.data), userAgent, event.at, now)));
  return json({ ok: true, accepted: events.length }, 202, { "x-request-id": requestId });
}

async function recordServerFailure(env, ctx, requestId, request, status, durationMs, message = "") {
  if (!env.DB || !ctx?.waitUntil) return;
  const synthetic = new Request("https://kutno.local/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": request.headers.get("user-agent") || "" },
    body: JSON.stringify({
      sessionId: "server",
      events: [{
        name: "server_error",
        level: "error",
        at: Date.now(),
        path: new URL(request.url).pathname,
        data: { status, durationMs, message },
      }],
    }),
  });
  ctx.waitUntil(saveTelemetry(synthetic, env, requestId).catch(() => {}));
}

function timedResponse(response, label, startedAt, requestId) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  headers.set("server-timing", `${label};dur=${Date.now() - startedAt}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    try {
      if (url.hostname === "www.kutno.ru") {
        url.hostname = "kutno.ru";
        return Response.redirect(url.toString(), 308);
      }

      const crawlerResponse = serveCrawlerRules(request);
      if (crawlerResponse) return timedResponse(crawlerResponse, "robots", startedAt, requestId);

      const sitemapResponse = serveFreshSitemap(request);
      if (sitemapResponse) return timedResponse(sitemapResponse, "sitemap", startedAt, requestId);

      const imageResponse = await serveRecipeImage(request, env);
      if (imageResponse) return timedResponse(imageResponse, "recipe-image", startedAt, requestId);

      const photoManifestResponse = serveRecipePhotoManifest(request);
      if (photoManifestResponse) return timedResponse(photoManifestResponse, "photo-manifest", startedAt, requestId);

      const publicAppResponse = await servePublicAppPage(request, env);
      if (publicAppResponse) return timedResponse(publicAppResponse, "public-app", startedAt, requestId);

      if ((url.pathname === "/lite" || url.pathname === "/lite/recipe") && request.method === "GET") {
        return timedResponse(serveLitePage(request), "lite", startedAt, requestId);
      }
      if (url.pathname === "/api/telemetry" && request.method === "POST") {
        return saveTelemetry(request, env, requestId);
      }
      if (url.pathname === "/api/catalog" && request.method === "GET") {
        return timedResponse(await serveCatalogPage(request, requestId), "catalog", startedAt, requestId);
      }
      if (url.pathname === "/api/catalog-index" && request.method === "GET") {
        return timedResponse(await serveCatalogIndex(request, requestId), "catalog-index", startedAt, requestId);
      }
      if (url.pathname.startsWith("/api/recipe/") && request.method === "GET") {
        return timedResponse(await serveRecipeDetail(request, requestId), "recipe", startedAt, requestId);
      }
      if (url.pathname === "/api/feature-state" || url.pathname.startsWith("/api/shared-recipes")) {
        await ensureFeatureStateTextSchema(env);
      }

      const response = await matchingWorker.fetch(request, env, ctx);
      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);
      headers.set("server-timing", `app;dur=${Date.now() - startedAt}`);
      if (response.status >= 500) recordServerFailure(env, ctx, requestId, request, response.status, Date.now() - startedAt);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "unknown");
      recordServerFailure(env, ctx, requestId, request, 500, Date.now() - startedAt, message);
      return json({ error: "Сервис временно недоступен", requestId }, 500, { "x-request-id": requestId });
    }
  },
};
