import safeWorker from "./safe-entry.js";

const MAX_CATALOG_LIMIT = 12;
const DEFAULT_CATALOG_LIMIT = 5;
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

export function encodeCatalogCursor(offset) {
  const value = `v1:${Math.max(0, Math.floor(Number(offset) || 0))}`;
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeCatalogCursor(cursor = "") {
  if (!cursor) return 0;
  try {
    const padded = String(cursor).replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(cursor.length / 4) * 4, "=");
    const value = atob(padded);
    const match = value.match(/^v1:(\d+)$/);
    return match ? Math.max(0, Number(match[1]) || 0) : 0;
  } catch {
    return 0;
  }
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

async function paginatedCatalog(request, env, ctx, requestId) {
  const url = new URL(request.url);
  const limit = Math.min(MAX_CATALOG_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_CATALOG_LIMIT));
  const offset = decodeCatalogCursor(url.searchParams.get("cursor") || "");
  url.searchParams.delete("limit");
  url.searchParams.delete("cursor");

  const upstream = await safeWorker.fetch(new Request(url.toString(), request), env, ctx);
  const data = await upstream.clone().json().catch(() => ({}));
  if (!upstream.ok || !Array.isArray(data.recipes)) {
    const headers = new Headers(upstream.headers);
    headers.set("x-request-id", requestId);
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  }

  const total = data.recipes.length;
  const recipes = data.recipes.slice(offset, offset + limit);
  const nextOffset = offset + recipes.length;
  const nextCursor = nextOffset < total ? encodeCatalogCursor(nextOffset) : "";
  return json({
    recipes,
    total,
    nextCursor,
    page: Math.floor(offset / limit) + 1,
    limit,
    catalogVersion: data.catalogVersion || "",
  }, 200, {
    "x-request-id": requestId,
    "x-kutno-catalog-page": String(Math.floor(offset / limit) + 1),
  });
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

export default {
  async fetch(request, env, ctx) {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/telemetry" && request.method === "POST") {
        return saveTelemetry(request, env, requestId);
      }
      if (url.pathname === "/api/catalog" && request.method === "GET") {
        return paginatedCatalog(request, env, ctx, requestId);
      }

      const response = await safeWorker.fetch(request, env, ctx);
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
