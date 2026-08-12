export const CATALOG_TTL_MS = 5 * 60 * 1000;

let runtimeCache = null;
let refreshPromise = null;

async function loadFromAssets(request, env) {
  if (!env?.ASSETS?.fetch) return null;
  const url = new URL("/recipe-data/catalog-runtime.json", request?.url || "https://kutno.test/");
  const response = await env.ASSETS.fetch(new Request(url, { method: "GET", headers: { accept: "application/json" } }));
  if (!response.ok) throw new Error(`catalog runtime asset ${response.status}`);
  return response.json();
}

async function loadFromNode() {
  if (typeof process === "undefined" || !process?.versions?.node) return null;
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/recipe-data/catalog-runtime.json", import.meta.url), "utf8");
  return JSON.parse(source);
}

async function readRuntimeCatalog(request, env) {
  const payload = await loadFromAssets(request, env) || await loadFromNode();
  const recipes = Array.isArray(payload?.recipes) ? payload.recipes : [];
  if (!recipes.length) throw new Error("Catalog runtime is unavailable");
  return {
    catalogVersion: String(payload?.catalogVersion || ""),
    matching: payload?.matching && typeof payload.matching === "object" ? payload.matching : {},
    recipes,
  };
}

function startColdLoad(request, env, now) {
  const promise = readRuntimeCatalog(request, env);
  runtimeCache = { at: now, promise };
  promise.catch(() => {
    if (runtimeCache?.promise === promise) runtimeCache = null;
  });
  return promise;
}

function startBackgroundRefresh(request, env, ctx) {
  if (refreshPromise) return refreshPromise;
  const fresh = readRuntimeCatalog(request, env);
  refreshPromise = fresh;
  const settled = fresh.then((value) => {
    runtimeCache = { at: Date.now(), promise: Promise.resolve(value) };
    return value;
  }).catch(() => null).finally(() => {
    if (refreshPromise === fresh) refreshPromise = null;
  });
  ctx?.waitUntil?.(settled);
  return fresh;
}

export async function loadRuntimeCatalog(request, env = {}, ctx = null) {
  const now = Date.now();
  if (!runtimeCache) return startColdLoad(request, env, now);
  if (now - runtimeCache.at < CATALOG_TTL_MS) return runtimeCache.promise;

  // Stale-while-refresh: не задерживаем пользовательский запрос чтением ассета.
  // Один refresh разделяется всеми параллельными запросами; ошибка не уничтожает
  // уже прогретый каталог.
  startBackgroundRefresh(request, env, ctx);
  return runtimeCache.promise;
}

export async function loadRuntimeRecipes(request, env = {}, ctx = null) {
  return (await loadRuntimeCatalog(request, env, ctx)).recipes;
}

export function resetRuntimeCatalogCacheForTests() {
  runtimeCache = null;
  refreshPromise = null;
}
