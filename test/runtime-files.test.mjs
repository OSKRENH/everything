import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeFiles = [
  "vite.config.js",
  "worker/entry.js",
  "worker/matching-entry.js",
  "worker/oil-fix-entry.js",
  "worker/safe-entry.js",
  "worker/manual-recipes.js",
  "src/ingredient-semantics.js",
  "src/ingredient-semantics-v2.js",
  "src/ingredient-semantics-v3.js",
  "src/kutno-bridge.inject.js",
  "src/matching-engine.inject.js",
  "src/fetch-reset.inject.js",
  "src/matching-fixes.inject.js",
  "src/catalog-performance.inject.js",
  "public/kutno-features.js",
  "public/dom-stability.js",
  "public/feature-sync-throttle.js",
];

test("runtime-файлы Кутно проходят синтаксическую проверку", () => {
  for (const file of runtimeFiles) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test("сборочный мост подключает прямую, устойчивую и плавную загрузку каталога", () => {
  const bridge = readFileSync("src/kutno-bridge.inject.js", "utf8");
  const matching = readFileSync("src/matching-engine.inject.js", "utf8");
  const reset = readFileSync("src/fetch-reset.inject.js", "utf8");
  const fixes = readFileSync("src/matching-fixes.inject.js", "utf8");
  const performance = readFileSync("src/catalog-performance.inject.js", "utf8");
  const catalogCss = readFileSync("public/catalog-stability.css", "utf8");
  const throttle = readFileSync("public/feature-sync-throttle.js", "utf8");
  const vite = readFileSync("vite.config.js", "utf8");
  assert.match(bridge, /window\.kutnoBridge\s*=/);
  assert.match(bridge, /restoreSwipeSnapshot/);
  assert.match(bridge, /restoreCookingSession/);
  assert.match(matching, /matchingGroupRecipes/);
  assert.match(matching, /Готовить сейчас/);
  assert.match(matching, /Хочу использовать/);
  assert.match(reset, /kutnoFetchBeforeMatching/);
  assert.match(reset, /window\.fetch = async function kutnoSafeMatchingFetch/);
  assert.match(fixes, /loadCatalog\(true\)/);
  assert.match(fixes, /catch\s*\{\s*pathname = ""/);
  assert.match(performance, /catalogDirectFetch/);
  assert.match(performance, /kutnoFetchBeforeMatching/);
  assert.match(performance, /requestCatalogDirectly/);
  assert.match(performance, /localCatalogFallback/);
  assert.match(performance, /catalogUsingFallback/);
  assert.match(performance, /CATALOG_INITIAL_SIZE = 5/);
  assert.match(performance, /CATALOG_INCREMENT = 1/);
  assert.match(performance, /CATALOG_RETRY_COUNT = 3/);
  assert.match(performance, /CATALOG_REVEAL_DURATION = 480/);
  assert.match(performance, /catalog-card-entering/);
  assert.match(performance, /matching-group-header-entering/);
  assert.match(performance, /rootMargin: "60px 0px"/);
  assert.match(performance, /IntersectionObserver/);
  assert.match(performance, /resilientCatalogLoad/);
  assert.match(performance, /performantCatalogResults/);
  assert.match(catalogCss, /@keyframes catalog-card-reveal/);
  assert.match(catalogCss, /prefers-reduced-motion/);
  assert.match(throttle, /catch\s*\{\s*pathname = ""/);
  assert.match(vite, /const kutnoFetchBeforeMatching = window\.fetch\.bind\(window\)/);
  assert.ok(vite.indexOf("${matchingSource}") < vite.indexOf("${fetchResetSource}"));
  assert.ok(vite.indexOf("${matchingFixesSource}") < vite.indexOf("${catalogPerformanceSource}"));
  assert.match(vite, /ingredient-semantics-v3/);
});

test("расширенные Worker-слои делегируют основной API", () => {
  const featureWorker = readFileSync("worker/entry.js", "utf8");
  const matchingWorker = readFileSync("worker/matching-entry.js", "utf8");
  const oilFixWorker = readFileSync("worker/oil-fix-entry.js", "utf8");
  const safeWorker = readFileSync("worker/safe-entry.js", "utf8");
  const manualCatalog = readFileSync("worker/manual-recipes.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.match(featureWorker, /return baseWorker\.fetch\(request, env, ctx\)/);
  assert.match(featureWorker, /\/api\/feature-state/);
  assert.match(featureWorker, /shared_recipes/);
  assert.match(matchingWorker, /return featureWorker\.fetch\(request, env, ctx\)/);
  assert.match(matchingWorker, /manualRecipesForPortions/);
  assert.match(oilFixWorker, /return matchingWorker\.fetch\(request, env, ctx\)/);
  assert.match(oilFixWorker, /ingredient-semantics-v3/);
  assert.match(safeWorker, /oilFixWorker\.fetch/);
  assert.match(safeWorker, /catalogFallback/);
  assert.match(wrangler, /worker\/safe-entry\.js/);
  assert.match(manualCatalog, /kutno-manual-catalog/);
});
