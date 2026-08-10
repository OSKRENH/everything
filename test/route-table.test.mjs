import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROUTES, matchRoute } from "../worker/routes.js";

function request(method, path) {
  return new Request(`https://kutno.test${path}`, { method });
}

test("порядок Worker-маршрутов задан одним явным списком", () => {
  const names = ROUTES.map((route) => route.name);
  assert.equal(new Set(names).size, names.length, "route names должны быть уникальны");
  assert.equal(names.at(-1), "assets");
  assert.ok(names.indexOf("robots") < names.indexOf("public-app"));
  assert.ok(names.indexOf("public-app") < names.indexOf("generate"));
  assert.ok(names.indexOf("generate") < names.indexOf("api-fallback"));
});

test("ключевые запросы выбирают ровно один ожидаемый обработчик", () => {
  const cases = [
    ["GET", "/sitemap.xml", "sitemap"],
    ["GET", "/robots.txt", "robots"],
    ["GET", "/recipes", "public-app"],
    ["GET", "/recipe/syrniki", "public-app"],
    ["GET", "/lite", "lite"],
    ["GET", "/api/catalog", "catalog"],
    ["GET", "/api/catalog-index", "catalog-index"],
    ["GET", "/api/recipe/catalog%3Afoo", "recipe"],
    ["POST", "/api/generate", "generate"],
    ["GET", "/api/matching-suggestions", "matching-suggestions"],
    ["GET", "/api/feature-state", "feature-state"],
    ["POST", "/api/shared-recipes", "shared-recipes-create"],
    ["GET", "/api/shared-recipes/abc", "shared-recipes-read"],
    ["GET", "/api/nonexistent", "api-fallback"],
    ["GET", "/anything", "assets"],
  ];
  for (const [method, path, expected] of cases) {
    assert.equal(matchRoute(request(method, path))?.name, expected, `${method} ${path}`);
  }
});

test("entrypoint больше не содержит вложенной цепочки Worker-ов", () => {
  const entry = readFileSync("worker/next-entry.js", "utf8");
  assert.match(entry, /dispatchRoute/);
  assert.doesNotMatch(entry, /matchingWorker|featureWorker|baseWorker|safeWorker|oilFixWorker/);
});

test("preview-конфиг включает строгие SEO-маркеры без включения их в production vars", () => {
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.match(wrangler, /"preview"\s*:\s*\{[\s\S]*"STRICT_SEO_MARKERS"\s*:\s*"true"/);
  const beforePreview = wrangler.split('"preview"')[0];
  assert.doesNotMatch(beforePreview, /STRICT_SEO_MARKERS/);
});
