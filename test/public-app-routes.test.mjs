import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { serveCrawlerRules, servePublicAppPage } from "../worker/public-app-pages.js";
import { seoRecipeEntries } from "../worker/seo-pages.js";

const indexHtml = readFileSync("index.html", "utf8");
const env = {
  ASSETS: {
    async fetch() {
      return new Response(indexHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    },
  },
};

test("новые публичные модули проходят синтаксическую проверку", () => {
  for (const file of ["worker/public-app-pages.js", "worker/fresh-sitemap.js", "src/public-routes.js"]) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test("app shell содержит устойчивые SEO-маркеры", () => {
  for (const marker of ["data-seo-kicker", "data-seo-title", "data-seo-copy", "data-seo-content"]) {
    assert.match(indexHtml, new RegExp(marker));
  }
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
  assert.match(html, new RegExp(`<h1[^>]*data-seo-title[^>]*>${entry.recipe.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/h1>`));
  assert.match(html, /data-seo-content[^>]*>[\s\S]*<h2>Ингредиенты<\/h2>[\s\S]*<h2>Как готовить<\/h2>/);
});

test("несуществующий рецепт не превращается в app shell", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipe/net-takogo"), env);
  assert.equal(response, null);
});

test("robots явно разрешает OpenAI и не кэшируется на edge", async () => {
  const response = serveCrawlerRules(new Request("https://kutno.ru/robots.txt"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  const body = await response.text();
  for (const agent of ["OAI-SearchBot", "GPTBot", "ChatGPT-User", "OAI-AdsBot", "*"]) {
    assert.match(body, new RegExp(`User-agent: ${agent.replace("*", "\\*")}\\nAllow: /`));
  }
  assert.match(body, /Disallow: \/api\//);
  assert.match(body, /Sitemap: https:\/\/kutno\.ru\/sitemap\.xml/);
});

test("клиентский маршрут открывает Базу и штатный recipe overlay", () => {
  const source = readFileSync("src/public-routes.js", "utf8");
  const bootstrap = readFileSync("src/bootstrap.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.match(source, /data-view=\\?"catalog/);
  assert.match(source, /kutnoBridge\.openRecipe/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /recipe-sheet/);
  assert.match(source, /history\.pushState/);
  assert.match(bootstrap, /await import\("\.\/public-routes\.js"\)/);
  assert.match(wrangler, /"\/recipe\/\*"/);
  assert.match(wrangler, /"\/robots\.txt"/);
});
