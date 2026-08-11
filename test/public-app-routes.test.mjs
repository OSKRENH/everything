import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { serveCrawlerRules, servePublicAppPage } from "../worker/public-app-pages.js";
import { recipeImageSet, recipeImageUrls, recipePhotoManifest, serveRecipePhotoManifest } from "../worker/recipe-images.js";
import { recipeHasPhoto } from "../worker/recipe-photo-catalog.js";
import { seoRecipeEntries } from "../worker/seo-pages.js";
import { runtimeEnv } from "./runtime-assets.mjs";

const indexHtml = readFileSync("index.html", "utf8");
const env = runtimeEnv(indexHtml, { STRICT_SEO_MARKERS: "true" });

test("новые публичные модули проходят синтаксическую проверку", () => {
  for (const file of ["worker/public-app-pages.js", "worker/fresh-sitemap.js", "worker/recipe-images.js", "worker/recipe-photo-catalog.js", "src/public-routes.js", "public/recipe-photos.js"]) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test("app shell содержит устойчивые SEO-маркеры", () => {
  for (const marker of ["data-seo-kicker", "data-seo-title", "data-seo-copy", "data-seo-content"]) assert.match(indexHtml, new RegExp(marker));
});

test("/recipes отдаёт основной shell и видимый серверный список", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipes"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-kutno-public-route"), "catalog");
  const html = await response.text();
  assert.match(html, /data-kutno-shell/);
  assert.match(html, /src="\/src\/bootstrap\.js\?v=1"/);
  assert.match(html, /window\.__KUTNO_PUBLIC_ROUTE__=\{"type":"catalog"/);
  assert.match(html, /"@type":"ItemList"/);
  assert.match(html, /<h1[^>]*data-seo-title[^>]*>Все рецепты<\/h1>/);
  assert.match(html, /<div[^>]*data-seo-content[^>]*>[\s\S]*<h2>Все рецепты<\/h2>/);
  assert.match(html, /class="seo-recipe-list"/);
  assert.doesNotMatch(html, /class="grid"/);
});

test("уникальный URL рецепта грузит shell, видимый рецепт и JSON-LD с датами", async () => {
  const entry = seoRecipeEntries(2)[0];
  const response = await servePublicAppPage(new Request(`https://kutno.ru${entry.pathname}`), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-kutno-public-route"), "recipe");
  const html = await response.text();
  assert.match(html, /data-kutno-shell/);
  assert.match(html, /src="\/src\/bootstrap\.js\?v=1"/);
  assert.ok(html.includes(`"id":"${entry.id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`));
  assert.match(html, /"@type":"Recipe"/);
  assert.match(html, /"recipeIngredient":\[/);
  assert.match(html, /"recipeInstructions":\[/);
  assert.match(html, /"datePublished":"2026-08-10"/);
  assert.match(html, /"dateModified":"2026-08-10"/);
  assert.match(html, /<meta property="og:type" content="article" \/>/);
  assert.match(html, new RegExp(`<h1[^>]*data-seo-title[^>]*>${entry.recipe.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/h1>`));
  assert.match(html, /data-seo-content[^>]*>[\s\S]*<h2>Ингредиенты<\/h2>[\s\S]*<h2>Как готовить<\/h2>/);
});

test("рецепт с иллюстрацией получает 16:9 OG/Twitter и три URL в Recipe JSON-LD", async () => {
  const entry = seoRecipeEntries(2).find((item) => item.slug === "syrniki");
  assert.ok(entry);
  const response = await servePublicAppPage(new Request(`https://kutno.ru${entry.pathname}`), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /property="og:image" content="https:\/\/kutno\.ru\/img\/syrniki-16x9\.webp"/);
  assert.match(html, /name="twitter:image" content="https:\/\/kutno\.ru\/img\/syrniki-16x9\.webp"/);
  assert.match(html, /"image":\["https:\/\/kutno\.ru\/img\/syrniki-1x1\.webp","https:\/\/kutno\.ru\/img\/syrniki-4x3\.webp","https:\/\/kutno\.ru\/img\/syrniki-16x9\.webp"\]/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test("рецепт без записи в фотокаталоге не получает image или og:image", async () => {
  const entry = seoRecipeEntries(2).find((item) => !recipeHasPhoto(item.recipe, item.slug));
  assert.ok(entry);
  const response = await servePublicAppPage(new Request(`https://kutno.ru${entry.pathname}`), env);
  const html = await response.text();
  assert.doesNotMatch(html, /"image":\[/);
  assert.doesNotMatch(html, /property="og:image"/);
  assert.doesNotMatch(html, /name="twitter:image"/);
  assert.match(html, /name="twitter:card" content="summary"/);
});

test("фото URL строятся только для slug из фотокаталога", () => {
  assert.equal(recipeHasPhoto({}, "syrniki"), true);
  assert.deepEqual(recipeImageUrls({}, "syrniki"), ["https://kutno.ru/img/syrniki-1x1.webp", "https://kutno.ru/img/syrniki-4x3.webp", "https://kutno.ru/img/syrniki-16x9.webp"]);
  assert.equal(recipeImageSet({}, "syrniki").social, "https://kutno.ru/img/syrniki-16x9.webp");
  assert.deepEqual(recipeImageUrls({}, "net-takogo-retsepta"), []);
});

test("фото-манифест возвращает ровно 119 подключённых рецептов", async () => {
  const photos = recipePhotoManifest(2);
  assert.equal(photos.length, 119);
  assert.equal(new Set(photos.map((item) => item.slug)).size, 119);
  const response = serveRecipePhotoManifest(new Request("https://kutno.ru/api/photo-manifest"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { photos });
});

test("/img полностью исключён из Worker/R2 и остаётся Static Assets маршрутом", () => {
  const routes = readFileSync("worker/routes.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.equal(routes.includes("serveRecipeImage"), false);
  assert.equal(routes.includes('"recipe-image"'), false);
  assert.equal(routes.includes('prefix("/img/'), false);
  assert.doesNotMatch(wrangler, /"\/img\/\*"/);
  assert.doesNotMatch(wrangler, /r2_buckets|\bIMAGES\b/);
  assert.match(wrangler, /"directory"\s*:\s*"\.\/dist"/);
  assert.match(wrangler, /"binding"\s*:\s*"ASSETS"/);
});

test("несуществующий рецепт возвращает 404 и noindex в единственном обработчике", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipe/net-takogo"), env);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  assert.match(await response.text(), /Рецепт не найден/);
});

test("robots явно разрешает OpenAI и не кэшируется на edge", async () => {
  const response = serveCrawlerRules(new Request("https://kutno.ru/robots.txt"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  const body = await response.text();
  for (const agent of ["OAI-SearchBot", "GPTBot", "ChatGPT-User", "OAI-AdsBot", "*"]) assert.match(body, new RegExp(`User-agent: ${agent.replace("*", "\\*")}\\nAllow: /`));
  assert.match(body, /Disallow: \/api\//);
  assert.match(body, /Sitemap: https:\/\/kutno\.ru\/sitemap\.xml/);
});

test("клиентский маршрут открывает Базу и штатный recipe overlay", () => {
  const source = readFileSync("src/public-routes.js", "utf8");
  const bootstrap = readFileSync("src/bootstrap.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  const photos = readFileSync("public/recipe-photos.js", "utf8");
  assert.match(source, /data-view=\\?"catalog/);
  assert.match(source, /kutnoBridge\.openRecipe/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /recipe-sheet/);
  assert.match(source, /history\.pushState/);
  assert.match(bootstrap, /await import\("\.\/public-routes\.js"\)/);
  assert.match(bootstrap, /\/recipe-photos\.js\?v=2/);
  assert.match(bootstrap, /\/responsive-layout\.css\?v=1/);
  assert.match(photos, /fetchPriority = "high"/);
  assert.match(photos, /image\.loading = "lazy"/);
  assert.match(photos, /image\.width = meta\.width/);
  assert.match(photos, /image\.height = meta\.height/);
  assert.match(wrangler, /"\/recipe\/\*"/);
  assert.doesNotMatch(wrangler, /"\/img\/\*"/);
  assert.match(wrangler, /"\/robots\.txt"/);
});
