import { saveTelemetry } from "./telemetry.js";

let baseWorkerModulePromise = null;
let featureWorkerModulePromise = null;
let matchingWorkerModulePromise = null;
let catalogModulePromise = null;
let publicAppModulePromise = null;
let sitemapModulePromise = null;
let liteModulePromise = null;
let recipeImagesModulePromise = null;
let featureMigrationModulePromise = null;

function methodIs(request, allowed) { return allowed.includes(request.method); }
function exact(path, methods, name, handler, before = []) { return { name, methods, path, handler, before }; }
function prefix(pathPrefix, methods, name, handler, before = []) { return { name, methods, prefix: pathPrefix, handler, before }; }
function custom(name, matches, handler, before = []) { return { name, matches, handler, before }; }

async function baseWorkerFetch(request, env, ctx) {
  baseWorkerModulePromise ||= import("./index.js");
  const { default: baseWorker } = await baseWorkerModulePromise;
  return baseWorker.fetch(request, env, ctx);
}

async function featureWorkerFetch(request, env, ctx) {
  featureWorkerModulePromise ||= import("./entry.js");
  const { default: featureWorker } = await featureWorkerModulePromise;
  return featureWorker.fetch(request, env, ctx);
}

async function matchingWorkerFetch(request, env, ctx) {
  matchingWorkerModulePromise ||= import("./matching-entry.js");
  const { default: matchingWorker } = await matchingWorkerModulePromise;
  return matchingWorker.fetch(request, env, ctx);
}

async function catalogModule() {
  catalogModulePromise ||= import("./catalog-page.js");
  return catalogModulePromise;
}

async function publicAppModule() {
  publicAppModulePromise ||= import("./public-app-pages.js");
  return publicAppModulePromise;
}

async function sitemapModule() {
  sitemapModulePromise ||= import("./fresh-sitemap.js");
  return sitemapModulePromise;
}

async function liteModule() {
  liteModulePromise ||= import("./lite-page.js");
  return liteModulePromise;
}

async function recipeImagesModule() {
  recipeImagesModulePromise ||= import("./recipe-images.js");
  return recipeImagesModulePromise;
}

const ensureSchemas = async ({ env }) => {
  featureMigrationModulePromise ||= import("./feature-state-migration.js");
  const { ensureFeatureStateTextSchema } = await featureMigrationModulePromise;
  return ensureFeatureStateTextSchema(env);
};
const toBase = ({ request, env, ctx }) => baseWorkerFetch(request, env, ctx);
const toFeature = ({ request, env, ctx }) => featureWorkerFetch(request, env, ctx);
const toMatching = ({ request, env, ctx }) => matchingWorkerFetch(request, env, ctx);

export const ROUTES = [
  exact("/robots.txt", ["GET", "HEAD"], "robots", async ({ request }) => (await publicAppModule()).serveCrawlerRules(request)),
  exact("/sitemap.xml", ["GET", "HEAD"], "sitemap", async ({ request }) => (await sitemapModule()).serveFreshSitemap(request)),
  exact("/api/photo-manifest", ["GET", "HEAD"], "photo-manifest", async ({ request }) => (await recipeImagesModule()).serveRecipePhotoManifest(request)),
  custom("public-app", ({ pathname, method }) => ["GET", "HEAD"].includes(method) && (pathname === "/recipes" || pathname === "/recipes/" || pathname === "/recipe" || pathname === "/recipe/" || pathname.startsWith("/recipe/")), async ({ request, env }) => (await publicAppModule()).servePublicAppPage(request, env)),
  custom("lite", ({ pathname, method }) => method === "GET" && (pathname === "/lite" || pathname === "/lite/recipe"), async ({ request, env }) => (await liteModule()).serveLitePage(request, env)),

  exact("/api/telemetry", ["POST"], "telemetry", ({ request, env, requestId }) => saveTelemetry(request, env, requestId)),
  exact("/api/catalog", ["GET"], "catalog", async ({ request, env, requestId }) => (await catalogModule()).serveCatalogPage(request, env, requestId)),
  exact("/api/catalog-index", ["GET"], "catalog-index", async ({ request, env, requestId }) => (await catalogModule()).serveCatalogIndex(request, env, requestId)),
  prefix("/api/recipe/", ["GET"], "recipe", async ({ request, env, requestId }) => (await catalogModule()).serveRecipeDetail(request, env, requestId)),

  exact("/api/generate", ["POST"], "generate", toMatching),
  exact("/api/matching-suggestions", ["GET"], "matching-suggestions", toMatching),

  exact("/api/feature-state", ["GET", "PUT"], "feature-state", toFeature, [ensureSchemas]),
  exact("/api/shared-recipes", ["POST"], "shared-recipes-create", toFeature, [ensureSchemas]),
  prefix("/api/shared-recipes/", ["GET"], "shared-recipes-read", toFeature, [ensureSchemas]),

  exact("/api/health", ["GET"], "health", toBase),
  exact("/api/config", ["GET"], "config", toBase),
  exact("/api/source-status", ["GET"], "source-status", toBase),
  exact("/api/auth/me", ["GET"], "auth-me", toBase),
  exact("/api/auth/login", ["POST"], "auth-login", toBase),
  exact("/api/auth/register", ["POST"], "auth-register", toBase),
  exact("/api/auth/logout", ["POST"], "auth-logout", toBase),
  exact("/api/auth/google", ["POST"], "auth-google", toBase),
  exact("/api/auth/yandex", ["GET"], "auth-yandex", toBase),
  exact("/api/auth/yandex/callback", ["GET"], "auth-yandex-callback", toBase),
  exact("/api/kitchen", ["GET", "PUT"], "kitchen", toBase),
  exact("/api/favorites", ["GET", "POST"], "favorites", toBase),
  prefix("/api/favorites/", ["DELETE"], "favorite-delete", toBase),

  prefix("/api/", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], "api-fallback", toBase),
  custom("assets", () => true, toBase),
];

function routeMatches(route, request, url) {
  if (route.matches) return route.matches({ request, url, pathname: url.pathname, method: request.method });
  if (!methodIs(request, route.methods || [])) return false;
  if (route.path) return url.pathname === route.path;
  if (route.prefix) return url.pathname.startsWith(route.prefix);
  return false;
}

export function matchRoute(request) {
  const url = new URL(request.url);
  return ROUTES.find((route) => routeMatches(route, request, url)) || null;
}

export async function dispatchRoute(request, env, ctx, requestId) {
  const route = matchRoute(request);
  if (!route) return { label: "assets", response: await baseWorkerFetch(request, env, ctx) };
  const context = { request, env, ctx, requestId, url: new URL(request.url), route };
  for (const before of route.before || []) await before(context);
  const response = await route.handler(context);
  if (!(response instanceof Response)) throw new Error(`Route ${route.name} did not return Response`);
  return { label: route.name, response };
}
