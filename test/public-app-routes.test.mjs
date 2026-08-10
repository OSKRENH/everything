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
  for (const file of ["worker/public-app-pages.js", "src/public-routes.js"]) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test("/recipes отдаёт основной shell Кутно, а не отдельную SEO-витрину", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipes"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-kutno-public-route"), "catalog");
  const html = await response.text();
  assert.match(html, /data-kutno-shell/);
  assert.match(html, /src="\/src\/bootstrap\.js\?v=1"/);
  assert.match(html, /window\.__KUTNO_PUBLIC_ROUTE__=\{"type":"catalog"/);
  assert.match(html, /"@type":"ItemList"/);
  assert.match(html, /<h1>Все рецепты<\/h1>/);
  assert.doesNotMatch(html, /class="grid"/);
});

test("уникальный URL рецепта грузит основной shell и штатный bootstrap", async () => {
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
  assert.match(html, new RegExp(`<h1>${entry.recipe.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/h1>`));
});

test("несуществующий рецепт не превращается в app shell", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipe/net-takogo"), env);
  assert.equal(response, null);
});

test("robots явно разрешает OpenAI и остальных ботов на публичных страницах", async () => {
  const response = serveCrawlerRules(new Request("https://kutno.ru/robots.txt"));
  assert.equal(response.status, 200);
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
