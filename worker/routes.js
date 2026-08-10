import baseWorker from "./index.js";
import featureWorker from "./entry.js";
import matchingWorker from "./matching-entry.js";
import { serveCatalogIndex, serveCatalogPage, serveRecipeDetail } from "./catalog-page.js";
import { ensureFeatureStateTextSchema } from "./feature-state-migration.js";
import { serveFreshSitemap } from "./fresh-sitemap.js";
import { serveLitePage } from "./lite-page.js";
import { serveCrawlerRules, servePublicAppPage } from "./public-app-pages.js";
import { serveRecipePhotoManifest } from "./recipe-images.js";
import { saveTelemetry } from "./telemetry.js";

function methodIs(request, allowed) { return allowed.includes(request.method); }
function exact(path, methods, name, handler, before = []) { return { name, methods, path, handler, before }; }
function prefix(pathPrefix, methods, name, handler, before = []) { return { name, methods, prefix: pathPrefix, handler, before }; }
function custom(name, matches, handler, before = []) { return { name, matches, handler, before }; }

const ensureSchemas = async ({ env }) => ensureFeatureStateTextSchema(env);
const toBase = ({ request, env, ctx }) => baseWorker.fetch(request, env, ctx);
const toFeature = ({ request, env, ctx }) => featureWorker.fetch(request, env, ctx);
const toMatching = ({ request, env, ctx }) => matchingWorker.fetch(request, env, ctx);

export const ROUTES = [
  exact("/robots.txt", ["GET", "HEAD"], "robots", ({ request }) => serveCrawlerRules(request)),
  exact("/sitemap.xml", ["GET", "HEAD"], "sitemap", ({ request }) => serveFreshSitemap(request)),
  exact("/api/photo-manifest", ["GET", "HEAD"], "photo-manifest", ({ request }) => serveRecipePhotoManifest(request)),
  custom("public-app", ({ pathname, method }) => ["GET", "HEAD"].includes(method) && (pathname === "/recipes" || pathname === "/recipes/" || pathname === "/recipe" || pathname === "/recipe/" || pathname.startsWith("/recipe/")), ({ request, env }) => servePublicAppPage(request, env)),
  custom("lite", ({ pathname, method }) => method === "GET" && (pathname === "/lite" || pathname === "/lite/recipe"), ({ request, env }) => serveLitePage(request, env)),

  exact("/api/telemetry", ["POST"], "telemetry", ({ request, env, requestId }) => saveTelemetry(request, env, requestId)),
  exact("/api/catalog", ["GET"], "catalog", ({ request, requestId }) => serveCatalogPage(request, requestId)),
  exact("/api/catalog-index", ["GET"], "catalog-index", ({ request, requestId }) => serveCatalogIndex(request, requestId)),
  prefix("/api/recipe/", ["GET"], "recipe", ({ request, env, requestId }) => serveRecipeDetail(request, env, requestId)),

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
  if (!route) return { label: "assets", response: await baseWorker.fetch(request, env, ctx) };
  const context = { request, env, ctx, requestId, url: new URL(request.url), route };
  for (const before of route.before || []) await before(context);
  const response = await route.handler(context);
  if (!(response instanceof Response)) throw new Error(`Route ${route.name} did not return Response`);
  return { label: route.name, response };
}
