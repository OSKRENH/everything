import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import worker from "../worker/next-entry.js";
import { seoRecipeEntries } from "../worker/seo-pages.js";
import { catalogRuntimeRecipes } from "../worker/catalog-page.js";
import { runtimeAssets } from "./runtime-assets.mjs";

const indexHtml = readFileSync("index.html", "utf8");

function statement(sql = "") {
  const query = String(sql);
  const state = {
    bind() { return state; },
    async first() { return null; },
    async all() {
      if (/PRAGMA\s+table_info\(user_feature_state\)/i.test(query)) return { results: [{ name: "user_id", type: "TEXT" }] };
      if (/PRAGMA\s+table_info\(shared_recipes\)/i.test(query)) return { results: [{ name: "created_by", type: "TEXT" }] };
      return { results: [] };
    },
    async run() { return { success: true, meta: { changes: 1, last_row_id: 1 } }; },
  };
  return state;
}

const env = {
  DB: {
    prepare(sql) { return statement(sql); },
    async batch(items) { return Promise.all(items.map((item) => item.run?.() || { success: true })); },
  },
  ASSETS: runtimeAssets(indexHtml),
};

const ctx = { waitUntil() {} };
const firstRecipe = seoRecipeEntries(2)[0];
const liteRecipeId = catalogRuntimeRecipes()[0].id;

function req(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request(`https://kutno.ru${path}`, init);
}

function contentShape(response) {
  return String(response.headers.get("content-type") || "").split(";")[0];
}

const cases = [
  ["GET /", req("GET", "/"), 200, "text/html"],
  ["GET /recipes", req("GET", "/recipes"), 200, "text/html"],
  ["GET /recipe/{slug}", req("GET", firstRecipe.pathname), 200, "text/html"],
  ["GET /sitemap.xml", req("GET", "/sitemap.xml"), 200, "application/xml"],
  ["GET /robots.txt", req("GET", "/robots.txt"), 200, "text/plain"],
  ["GET /lite", req("GET", "/lite"), 200, "text/html"],
  ["GET /lite/recipe", req("GET", `/lite/recipe?id=${encodeURIComponent(liteRecipeId)}`), 200, "text/html"],
  ["GET /api/health", req("GET", "/api/health"), 200, "application/json"],
  ["GET /api/config", req("GET", "/api/config"), 200, "application/json"],
  ["GET /api/source-status", req("GET", "/api/source-status"), 200, "application/json"],
  ["GET /api/catalog", req("GET", "/api/catalog"), 200, "application/json"],
  ["GET /api/catalog-index", req("GET", "/api/catalog-index"), 200, "application/json"],
  ["GET /api/recipe/{id}", req("GET", `/api/recipe/${encodeURIComponent(firstRecipe.id)}`), 200, "application/json"],
  ["GET /api/matching-suggestions", req("GET", "/api/matching-suggestions?ingredient=яйца"), 200, "application/json"],
  ["POST /api/generate", req("POST", "/api/generate", { ingredients: ["яйца", "картошка", "лук"] }), 200, "application/json"],
  ["POST /api/telemetry", req("POST", "/api/telemetry", { sessionId: "golden", events: [] }), 202, "application/json"],
  ["GET /api/auth/me", req("GET", "/api/auth/me"), 401, "application/json"],
  ["POST /api/auth/login", req("POST", "/api/auth/login", {}), 401, "application/json"],
  ["POST /api/auth/register", req("POST", "/api/auth/register", {}), 400, "application/json"],
  ["POST /api/auth/logout", req("POST", "/api/auth/logout", {}), 200, "application/json"],
  ["POST /api/auth/google", req("POST", "/api/auth/google", {}), 401, "application/json"],
  ["GET /api/auth/yandex", req("GET", "/api/auth/yandex"), 302, ""],
  ["GET /api/auth/yandex/callback", req("GET", "/api/auth/yandex/callback"), 302, ""],
  ["PUT /api/kitchen", req("PUT", "/api/kitchen", {}), 401, "application/json"],
  ["GET /api/favorites", req("GET", "/api/favorites"), 401, "application/json"],
  ["POST /api/favorites", req("POST", "/api/favorites", {}), 401, "application/json"],
  ["DELETE /api/favorites/{id}", req("DELETE", "/api/favorites/test"), 401, "application/json"],
  ["GET /api/feature-state", req("GET", "/api/feature-state"), 401, "application/json"],
  ["PUT /api/feature-state", req("PUT", "/api/feature-state", {}), 401, "application/json"],
  ["POST /api/shared-recipes", req("POST", "/api/shared-recipes", {}), 401, "application/json"],
  ["GET /api/shared-recipes/{id}", req("GET", "/api/shared-recipes/not-found"), 404, "application/json"],
  ["GET /nonexistent-page", req("GET", "/nonexistent-page"), 404, "text/plain"],
  ["GET /api/nonexistent", req("GET", "/api/nonexistent"), 404, "application/json"],
];

test("golden routes сохраняют внешний контракт после разгрузки Worker", async () => {
  for (const [name, request, status, type] of cases) {
    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, status, name);
    assert.equal(contentShape(response), type, `${name}: content-type`);
    if (request.url.includes("/api/") && type === "application/json") {
      const data = await response.clone().json();
      assert.equal(typeof data, "object", `${name}: json object`);
    }
  }
});

test("golden routes фиксируют ключевые заголовки SEO и API", async () => {
  const recipe = await worker.fetch(req("GET", firstRecipe.pathname), env, ctx);
  assert.match(recipe.headers.get("cache-control") || "", /stale-while-revalidate=600/);
  assert.equal(recipe.headers.get("x-kutno-public-route"), "recipe");
  assert.ok(recipe.headers.get("x-request-id"));

  const sitemap = await worker.fetch(req("GET", "/sitemap.xml"), env, ctx);
  assert.equal(sitemap.headers.get("cache-control"), "no-store");
  assert.equal(sitemap.headers.get("cdn-cache-control"), "no-store");

  const api = await worker.fetch(req("GET", "/api/catalog"), env, ctx);
  assert.ok(api.headers.get("x-request-id"));
  assert.match(api.headers.get("server-timing") || "", /catalog/);
});
