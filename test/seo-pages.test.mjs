import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { seoRecipeEntries, seoSlug } from "../worker/seo-pages.js";
import { serveFreshSitemap } from "../worker/fresh-sitemap.js";
import { serveCrawlerRules, servePublicAppPage } from "../worker/public-app-pages.js";
import { runtimeEnv } from "./runtime-assets.mjs";

const indexHtml = readFileSync("index.html", "utf8");
const env = runtimeEnv(indexHtml, { STRICT_SEO_MARKERS: "true" });

test("SEO slug стабилен и пригоден для URL", () => {
  assert.equal(seoSlug("Жареная картошка с луком"), "zharenaya-kartoshka-s-lukom");
  assert.equal(seoSlug("Cacio e Pepe"), "cacio-e-pepe");
});

test("у каждого рецепта есть уникальная индексируемая ссылка", () => {
  const entries = seoRecipeEntries(2);
  assert.ok(entries.length > 20);
  assert.equal(new Set(entries.map((entry) => entry.slug)).size, entries.length);
  assert.ok(entries.every((entry) => entry.pathname === `/recipe/${entry.slug}`));
});

test("страница всех рецептов отдаётся рабочим app shell и ItemList", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipes"), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1[^>]*data-seo-title[^>]*>Все рецепты<\/h1>/);
  assert.match(html, /rel="canonical" href="https:\/\/kutno\.ru\/recipes"/);
  assert.match(html, /"@type":"ItemList"/);
  assert.match(html, /href="\/recipe\//);
  assert.equal((html.match(/<meta\s+name="robots"/gi) || []).length, 1);
  assert.match(html, /name="robots" content="index,follow,max-snippet:-1,max-image-preview:large"/);
});

test("страница рецепта содержит canonical, Recipe JSON-LD, ингредиенты и шаги", async () => {
  const entry = seoRecipeEntries(2)[0];
  const response = await servePublicAppPage(new Request(`https://kutno.ru${entry.pathname}`), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, new RegExp(`rel="canonical" href="https://kutno\\.ru${entry.pathname.replaceAll("/", "\\/")}"`));
  assert.match(html, /"@type":"Recipe"/);
  assert.match(html, /"recipeIngredient":\[/);
  assert.match(html, /"recipeInstructions":\[/);
  assert.match(html, /"dateModified":"2026-08-17"/);
  assert.match(html, /<h2>Ингредиенты<\/h2>/);
  assert.match(html, /<h2>Как готовить<\/h2>/);
  assert.equal((html.match(/<meta\s+name="robots"/gi) || []).length, 1);
});

test("несуществующий рецепт возвращает настоящий 404 и noindex", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipe/takogo-retsepta-net"), env);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  assert.match(await response.text(), /Рецепт не найден/);
});

test("sitemap содержит каталог и все страницы рецептов", async () => {
  const entries = seoRecipeEntries(2);
  const response = serveFreshSitemap(new Request("https://kutno.ru/sitemap.xml"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/xml/);
  const xml = await response.text();
  assert.match(xml, /<loc>https:\/\/kutno\.ru\/recipes<\/loc>/);
  assert.match(xml, /<lastmod>2026-08-17<\/lastmod>/);
  for (const entry of entries) assert.ok(xml.includes(`<loc>https://kutno.ru${entry.pathname}</loc>`));
});

test("robots открывает публичные страницы и указывает sitemap", async () => {
  const response = serveCrawlerRules(new Request("https://kutno.ru/robots.txt"));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.match(text, /Allow: \//);
  assert.match(text, /Disallow: \/api\//);
  assert.match(text, /Sitemap: https:\/\/kutno\.ru\/sitemap\.xml/);
});

test("канонические URL не размножаются завершающим слешем", async () => {
  const list = await servePublicAppPage(new Request("https://kutno.ru/recipes/"), env);
  assert.equal(list.status, 301);
  assert.equal(list.headers.get("location"), "https://kutno.ru/recipes");

  const entry = seoRecipeEntries(2)[0];
  const recipe = await servePublicAppPage(new Request(`https://kutno.ru${entry.pathname}/`), env);
  assert.equal(recipe.status, 301);
  assert.equal(recipe.headers.get("location"), `https://kutno.ru${entry.pathname}`);
});

test("/recipe без slug ведёт в базу", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipe"), env);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://kutno.ru/recipes");
});
