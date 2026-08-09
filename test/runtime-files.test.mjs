import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeFiles = [
  "vite.config.js", "worker/entry.js", "worker/matching-entry.js", "worker/oil-fix-entry.js", "worker/safe-entry.js", "worker/next-entry.js", "worker/catalog-cursor.js", "worker/catalog-page.js", "worker/lite-page.js", "worker/manual-recipes.js", "worker/simple-recipes.js",
  "src/bootstrap.js", "src/ingredient-semantics.js", "src/ingredient-semantics-v2.js", "src/ingredient-semantics-v3.js", "src/kutno-api.js", "src/kutno-store.js", "src/kutno-next.js", "src/kutno-bridge.inject.js", "src/matching-engine.inject.js", "src/fetch-reset.inject.js", "src/matching-fixes.inject.js", "src/catalog-performance.inject.js", "src/catalog-facets.inject.js", "src/catalog-render-meta.inject.js", "src/catalog-scroll-fill.inject.js", "src/swipe-full-catalog.inject.js", "src/matching-core-v4.inject.js", "src/kitchen-simplified.inject.js", "src/kitchen-smart-suggestions.inject.js", "src/catalog-detail.inject.js",
  "public/kutno-features.js", "public/feature-sync-throttle.js", "public/sw.js",
];

test("runtime-файлы Кутно проходят синтаксическую проверку", () => {
  for (const file of runtimeFiles) {
    const result = spawnSync(process.execPath, ["--check", file], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test("клиент быстро открывает каталог, индекс и детали грузит отдельно", () => {
  const bridge = readFileSync("src/kutno-bridge.inject.js", "utf8");
  const performance = readFileSync("src/catalog-performance.inject.js", "utf8");
  const facets = readFileSync("src/catalog-facets.inject.js", "utf8");
  const renderMeta = readFileSync("src/catalog-render-meta.inject.js", "utf8");
  const scrollFill = readFileSync("src/catalog-scroll-fill.inject.js", "utf8");
  const smart = readFileSync("src/kitchen-smart-suggestions.inject.js", "utf8");
  const detail = readFileSync("src/catalog-detail.inject.js", "utf8");
  const api = readFileSync("src/kutno-api.js", "utf8");
  const bootstrap = readFileSync("src/bootstrap.js", "utf8");
  const serviceWorker = readFileSync("public/sw.js", "utf8");
  const vite = readFileSync("vite.config.js", "utf8");
  const index = readFileSync("index.html", "utf8");

  assert.match(bridge, /window\.kutnoBridge\s*=/);
  assert.match(performance, /CATALOG_PAGE_SIZE = 5/);
  assert.match(performance, /kutnoApi\.catalogPage/);
  assert.match(performance, /catalogSeenCursors/);
  assert.match(performance, /catalogScrollVersion/);
  assert.match(performance, /IntersectionObserver/);
  assert.match(facets, /catalogIndexLoadPromise/);
  assert.match(facets, /catalogMetadataTotal/);
  assert.match(facets, /knownCatalogTotal/);
  assert.match(facets, /kutnoApi\.catalogIndex/);
  assert.match(facets, /requestIdleCallback/);
  assert.match(facets, /В базе/);
  assert.match(renderMeta, /catalogCountHtmlV6/);
  assert.match(renderMeta, /requestCatalogPageWithMetadataV6/);
  assert.match(renderMeta, /refreshCatalogCountV6/);
  assert.match(renderMeta, /MutationObserver/);
  assert.match(renderMeta, /count\.innerHTML !== next/);
  assert.match(scrollFill, /finishCatalogRevealWithViewportFillV6/);
  assert.match(scrollFill, /sentinelIsNearViewport/);
  assert.match(scrollFill, /revealNextCatalogItem/);
  assert.match(smart, /kutnoApi\.matchingSuggestions/);
  assert.match(smart, /smart-unlock-ingredient/);
  assert.match(detail, /hydrateCatalogRecipeV6/);
  assert.match(detail, /kutnoApi\.recipeDetail/);
  assert.match(detail, /toggleFavoriteWithCatalogHydrationV6/);
  assert.match(detail, /stopImmediatePropagation/);
  assert.match(api, /catalogIndex\(\)/);
  assert.match(api, /recipeDetail\(id/);
  assert.match(api, /matchingSuggestions/);
  assert.match(bootstrap, /await import\("\.\/main\.js"\)/);
  assert.match(bootstrap, /requestIdleCallback/);
  assert.match(bootstrap, /navigator\.serviceWorker\.register/);
  assert.match(serviceWorker, /kutno-resilient-v2/);
  assert.match(vite, /catalog-render-meta\.inject\.js/);
  assert.match(vite, /catalog-scroll-fill\.inject\.js/);
  assert.match(vite, /kitchen-smart-suggestions\.inject\.js/);
  assert.match(vite, /catalog-detail\.inject\.js/);
  assert.ok(vite.indexOf("${catalogFacetsSource}") < vite.indexOf("${catalogRenderMetaSource}"));
  assert.ok(vite.indexOf("${catalogRenderMetaSource}") < vite.indexOf("${catalogScrollFillSource}"));
  assert.ok(vite.indexOf("${catalogScrollFillSource}") < vite.indexOf("${swipeFullCatalogSource}"));
  assert.ok(vite.indexOf("${kitchenSimplifiedSource}") < vite.indexOf("${kitchenSmartSuggestionsSource}"));
  assert.ok(vite.indexOf("${kitchenSmartSuggestionsSource}") < vite.indexOf("${catalogDetailSource}"));
  assert.match(index, /bootstrap\.js\?v=1/);
  assert.match(index, /data-kutno-shell/);
  assert.match(index, /href="\/lite"/);
  assert.doesNotMatch(index, /rel="preload" as="image"/);
});

test("Worker использует лёгкий статический индекс и не запускает AI в обычном подборе", () => {
  const featureWorker = readFileSync("worker/entry.js", "utf8");
  const matchingWorker = readFileSync("worker/matching-entry.js", "utf8");
  const oilFixWorker = readFileSync("worker/oil-fix-entry.js", "utf8");
  const safeWorker = readFileSync("worker/safe-entry.js", "utf8");
  const nextWorker = readFileSync("worker/next-entry.js", "utf8");
  const catalogPage = readFileSync("worker/catalog-page.js", "utf8");
  const simpleCatalog = readFileSync("worker/simple-recipes.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");

  assert.match(featureWorker, /return baseWorker\.fetch\(request, env, ctx\)/);
  assert.match(matchingWorker, /catalogSources/);
  assert.match(matchingWorker, /matchingCatalog/);
  assert.match(matchingWorker, /matchingAmount/);
  assert.match(matchingWorker, /ingredientUnlockSuggestions/);
  assert.match(matchingWorker, /!incoming\.aiIdeas/);
  assert.match(matchingWorker, /compactMatchedRecipe/);
  assert.doesNotMatch(matchingWorker, /loadCatalogForMatching/);
  assert.match(oilFixWorker, /return matchingWorker\.fetch\(request, env, ctx\)/);
  assert.match(safeWorker, /oilFixWorker\.fetch/);
  assert.match(nextWorker, /serveCatalogPage/);
  assert.match(nextWorker, /serveCatalogIndex/);
  assert.match(nextWorker, /serveRecipeDetail/);
  assert.match(nextWorker, /\/api\/catalog-index/);
  assert.match(nextWorker, /\/api\/recipe\//);
  assert.match(catalogPage, /WORLD_RECIPE_CATALOG/);
  assert.match(catalogPage, /simpleRecipesForPortions/);
  assert.match(catalogPage, /pageSources = sources\.slice/);
  assert.match(catalogPage, /compactRecipeForSource/);
  assert.match(catalogPage, /serveCatalogIndex/);
  assert.match(catalogPage, /serveRecipeDetail/);
  assert.match(catalogPage, /stale-while-revalidate/);
  assert.match(simpleCatalog, /kutno-simple-catalog/);
  assert.match(wrangler, /worker\/next-entry\.js/);
});
