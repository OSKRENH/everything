const MAX_TELEMETRY_EVENTS = 20;

export function json(data, status = 200, headers = {}) {
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

export async function saveTelemetry(request, env, requestId) {
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

export function recordServerFailure(env, ctx, requestId, request, status, durationMs, message = "") {
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
