import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeFiles = [
  "vite.config.js", "worker/index.js", "worker/entry.js", "worker/matching-entry.js", "worker/next-entry.js", "worker/routes.js", "worker/telemetry.js", "worker/catalog-cursor.js", "worker/catalog-page.js", "worker/catalog-runtime-store.js", "worker/lite-page.js", "worker/generated/catalog-runtime.js", "worker/feature-state-migration.js", "worker/fresh-sitemap.js", "worker/public-app-pages.js", "worker/recipe-images.js", "worker/seo-pages.js",
  "src/bootstrap.js", "src/ingredient-semantics.js", "src/ingredient-semantics-v2.js", "src/ingredient-semantics-v3.js", "src/kutno-api.js", "src/kutno-store.js", "src/kutno-next.js", "src/kutno-bridge.inject.js", "src/matching-engine.inject.js", "src/fetch-reset.inject.js", "src/matching-fixes.inject.js", "src/catalog-performance.inject.js", "src/catalog-facets.inject.js", "src/catalog-render-meta.inject.js", "src/catalog-scroll-fill.inject.js", "src/swipe-full-catalog.inject.js", "src/matching-core-v4.inject.js", "src/kitchen-simplified.inject.js", "src/kitchen-smart-suggestions.inject.js", "src/catalog-detail.inject.js", "src/audit-v7.inject.js",
  "public/kutno-features.js", "public/feature-sync-throttle.js", "public/recipe-photos.js", "public/sw.js",
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
  const audit = readFileSync("src/audit-v7.inject.js", "utf8");
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
  assert.match(audit, /Готовьте сейчас/);
  assert.match(audit, /stripEquipmentSectionV7/);
  assert.match(api, /catalogIndex\(\)/);
  assert.match(api, /recipeDetail\(id/);
  assert.match(api, /matchingSuggestions/);
  assert.match(bootstrap, /await import\("\.\/main\.js"\)/);
  assert.match(bootstrap, /requestIdleCallback/);
  assert.match(bootstrap, /navigator\.serviceWorker\.register/);
  assert.match(bootstrap, /updateViaCache: "none"/);
  assert.match(serviceWorker, /kutno-resilient-v3/);
  assert.match(serviceWorker, /navigationNetworkOnly/);
  assert.match(serviceWorker, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.doesNotMatch(serviceWorker, /cache\.add\("\/"\)/);
  assert.match(vite, /catalog-render-meta\.inject\.js/);
  assert.match(vite, /catalog-scroll-fill\.inject\.js/);
  assert.match(vite, /kitchen-smart-suggestions\.inject\.js/);
  assert.match(vite, /catalog-detail\.inject\.js/);
  assert.match(vite, /audit-v7\.inject\.js/);
  assert.ok(vite.indexOf("${catalogFacetsSource}") < vite.indexOf("${catalogRenderMetaSource}"));
  assert.ok(vite.indexOf("${catalogRenderMetaSource}") < vite.indexOf("${catalogScrollFillSource}"));
  assert.ok(vite.indexOf("${catalogScrollFillSource}") < vite.indexOf("${swipeFullCatalogSource}"));
  assert.ok(vite.indexOf("${kitchenSimplifiedSource}") < vite.indexOf("${kitchenSmartSuggestionsSource}"));
  assert.ok(vite.indexOf("${kitchenSmartSuggestionsSource}") < vite.indexOf("${catalogDetailSource}"));
  assert.ok(vite.indexOf("${catalogDetailSource}") < vite.indexOf("${auditV7Source}"));
  assert.match(index, /bootstrap\.js\?v=1/);
  assert.match(index, /data-kutno-shell/);
  assert.match(index, /data-seo-content/);
  assert.match(index, /href="\/lite"/);
  assert.doesNotMatch(index, /rel="preload" as="image"/);
});

test("Worker использует компактный runtime-каталог и один явный диспетчер маршрутов", () => {
  const matchingWorker = readFileSync("worker/matching-entry.js", "utf8");
  const nextWorker = readFileSync("worker/next-entry.js", "utf8");
  const routes = readFileSync("worker/routes.js", "utf8");
  const catalogPage = readFileSync("worker/catalog-page.js", "utf8");
  const runtimeStore = readFileSync("worker/catalog-runtime-store.js", "utf8");
  const seo = readFileSync("worker/seo-pages.js", "utf8");
  const lite = readFileSync("worker/lite-page.js", "utf8");
  const v1 = readFileSync("src/ingredient-semantics.js", "utf8");
  const v2 = readFileSync("src/ingredient-semantics-v2.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  const workerBuild = readFileSync("scripts/build-worker.mjs", "utf8");

  assert.match(matchingWorker, /loadRuntimeRecipes/);
  assert.match(matchingWorker, /matchingCatalog/);
  assert.match(matchingWorker, /MATCHING_CANDIDATE_LIMIT = 72/);
  assert.match(matchingWorker, /matchingCandidatePool/);
  assert.match(matchingWorker, /rankAndSuggestRecipes/);
  assert.doesNotMatch(matchingWorker, /enrichRecipeSemantics/);
  assert.doesNotMatch(matchingWorker, /ingredientUnlockSuggestions/);
  assert.match(matchingWorker, /!incoming\.aiIdeas/);
  assert.match(matchingWorker, /compactMatchedRecipe/);
  assert.doesNotMatch(matchingWorker, /catalogSources|recipe-catalog\.js|simple-recipes|home-recipes|manual-recipes/);
  assert.match(nextWorker, /dispatchRoute/);
  assert.doesNotMatch(nextWorker, /matchingWorker|featureWorker|baseWorker|safeWorker|oilFixWorker/);
  assert.match(routes, /export const ROUTES = \[/);
  assert.match(routes, /exact\("\/api\/generate"/);
  assert.match(routes, /exact\("\/api\/catalog"/);
  assert.match(routes, /exact\("\/api\/feature-state"/);
  assert.match(routes, /custom\("assets"/);
  assert.match(routes, /ensureFeatureStateTextSchema/);
  assert.match(catalogPage, /RUNTIME_RECIPES/);
  assert.match(catalogPage, /loadRuntimeRecipes/);
  assert.match(catalogPage, /recipe-data/);
  assert.match(catalogPage, /RECIPE_BODIES/);
  assert.match(catalogPage, /serveCatalogIndex/);
  assert.match(catalogPage, /serveRecipeDetail/);
  assert.match(runtimeStore, /\/recipe-data\/catalog-runtime\.json/);
  assert.match(runtimeStore, /env\?\.ASSETS\?\.fetch/);
  assert.doesNotMatch(catalogPage, /recipe-catalog\.js|simple-recipes|home-recipes|manual-recipes/);
  assert.doesNotMatch(seo, /recipe-catalog\.js|simple-recipes|home-recipes|manual-recipes/);
  assert.doesNotMatch(lite, /recipe-catalog\.js|simple-recipes|home-recipes|manual-recipes/);
  assert.match(v1, /export \* from "\.\/ingredient-semantics-v3\.js"/);
  assert.match(v2, /export \* from "\.\/ingredient-semantics-v3\.js"/);
  assert.match(wrangler, /\.worker-build\/index\.js/);
  assert.match(wrangler, /"no_bundle"\s*:\s*true/);
  assert.match(wrangler, /node scripts\/build-worker\.mjs/);
  assert.match(workerBuild, /worker\/next-entry\.js/);
  assert.match(workerBuild, /charset:\s*"utf8"/);
});
