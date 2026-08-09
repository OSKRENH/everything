const DEFAULT_TIMEOUT = 15_000;

export class KutnoApiError extends Error {
  constructor(message, { status = 0, code = "", data = null } = {}) {
    super(message);
    this.name = "KutnoApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function safeJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function telemetrySessionId() {
  const key = "kutno-telemetry-session-v1";
  try {
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID?.() || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "anonymous";
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT);
  const startedAt = performance.now();
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      signal: options.signal || controller.signal,
    });
    const text = await response.text();
    const data = safeJson(text);
    if (!response.ok) {
      throw new KutnoApiError(data.error || `Ошибка запроса (${response.status})`, {
        status: response.status,
        code: data.code || "",
        data,
      });
    }
    if (!path.startsWith("/api/telemetry")) {
      queueTelemetry("api_request", {
        path: String(path).split("?", 1)[0],
        method: options.method || "GET",
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      }, "debug");
    }
    return data;
  } catch (error) {
    if (!path.startsWith("/api/telemetry")) {
      queueTelemetry("api_error", {
        path: String(path).split("?", 1)[0],
        method: options.method || "GET",
        durationMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : String(error),
      }, "error");
    }
    if (error?.name === "AbortError") throw new KutnoApiError("Сервер отвечает слишком долго", { code: "timeout" });
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

let telemetryQueue = [];
let telemetryTimer = 0;
let telemetryInstalled = false;

function flushTelemetry() {
  window.clearTimeout(telemetryTimer);
  telemetryTimer = 0;
  if (!telemetryQueue.length) return;
  const events = telemetryQueue.splice(0, 20);
  const body = JSON.stringify({ sessionId: telemetrySessionId(), events });
  try {
    if (navigator.sendBeacon?.("/api/telemetry", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Ниже используем fetch.
  }
  fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function queueTelemetry(name, data = {}, level = "info") {
  telemetryQueue.push({
    name: String(name || "event").slice(0, 80),
    level: ["debug", "info", "warn", "error"].includes(level) ? level : "info",
    at: Date.now(),
    path: location.pathname + location.hash,
    data,
  });
  if (telemetryQueue.length >= 10) flushTelemetry();
  else if (!telemetryTimer) telemetryTimer = window.setTimeout(flushTelemetry, 2500);
}

export function installGlobalTelemetry() {
  if (telemetryInstalled) return;
  telemetryInstalled = true;
  window.addEventListener("error", (event) => queueTelemetry("client_error", {
    message: event.message,
    file: event.filename?.split("/").at(-1) || "",
    line: event.lineno || 0,
    column: event.colno || 0,
  }, "error"));
  window.addEventListener("unhandledrejection", (event) => queueTelemetry("unhandled_rejection", {
    message: event.reason instanceof Error ? event.reason.message : String(event.reason || "unknown"),
  }, "error"));
  window.addEventListener("pagehide", flushTelemetry);
  window.setTimeout(() => {
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    queueTelemetry("app_ready", {
      loadMs: navigation ? Math.round(navigation.loadEventEnd || performance.now()) : Math.round(performance.now()),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
  }, 0);
}

export const kutnoApi = {
  request,
  catalogPage({ portions = 2, limit = 5, cursor = "" } = {}) {
    const params = new URLSearchParams({ portions: String(portions), limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request(`/api/catalog?${params}`);
  },
  catalogIndex() {
    return request("/api/catalog-index", { timeout: 8_000 });
  },
  recipeDetail(id, { portions = 2 } = {}) {
    const params = new URLSearchParams({ portions: String(Math.max(1, Number(portions) || 2)) });
    return request(`/api/recipe/${encodeURIComponent(String(id || ""))}?${params}`, { timeout: 8_000 });
  },
  matchingSuggestions({ ingredients = [], equipment = [], baseIngredients = [] } = {}) {
    const params = new URLSearchParams();
    ingredients.forEach((value) => params.append("ingredient", String(value)));
    equipment.forEach((value) => params.append("equipment", String(value)));
    baseIngredients.forEach((value) => params.append("base", String(value)));
    return request(`/api/matching-suggestions?${params}`, { timeout: 6_000 });
  },
  getFeatureState() {
    return request("/api/feature-state");
  },
  putFeatureState(state) {
    return request("/api/feature-state", { method: "PUT", body: JSON.stringify(state) });
  },
  telemetry: queueTelemetry,
  flushTelemetry,
};
