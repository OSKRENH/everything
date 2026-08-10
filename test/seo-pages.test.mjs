import assert from "node:assert/strict";
import test from "node:test";
import { seoRecipeEntries, seoSlug, serveSeoRequest } from "../worker/seo-pages.js";

async function body(response) {
  return response.text();
}

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

test("страница всех рецептов отдаётся готовым HTML и ItemList", async () => {
  const response = serveSeoRequest(new Request("https://kutno.ru/recipes"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  const html = await body(response);
  assert.match(html, /<h1>Рецепты Кутно<\/h1>/);
  assert.match(html, /rel="canonical" href="https:\/\/kutno\.ru\/recipes"/);
  assert.match(html, /"@type":"ItemList"/);
  assert.match(html, /href="\/recipe\//);
});

test("страница рецепта содержит canonical, Recipe JSON-LD, ингредиенты и шаги", async () => {
  const entry = seoRecipeEntries(2)[0];
  const response = serveSeoRequest(new Request(`https://kutno.ru${entry.pathname}`));
  assert.equal(response.status, 200);
  const html = await body(response);
  assert.match(html, new RegExp(`rel="canonical" href="https://kutno\\.ru${entry.pathname.replaceAll("/", "\\/")}"`));
  assert.match(html, /"@type":"Recipe"/);
  assert.match(html, /"recipeIngredient":\[/);
  assert.match(html, /"recipeInstructions":\[/);
  assert.match(html, /<h2>Ингредиенты<\/h2>/);
  assert.match(html, /<h2>Как готовить<\/h2>/);
});

test("несуществующий рецепт возвращает настоящий 404 и noindex", async () => {
  const response = serveSeoRequest(new Request("https://kutno.ru/recipe/takogo-retsepta-net"));
  assert.equal(response.status, 404);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  assert.match(await body(response), /Рецепт не найден/);
});

test("sitemap содержит каталог и все страницы рецептов", async () => {
  const entries = seoRecipeEntries(2);
  const response = serveSeoRequest(new Request("https://kutno.ru/sitemap.xml"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/xml/);
  const xml = await body(response);
  assert.match(xml, /<loc>https:\/\/kutno\.ru\/recipes<\/loc>/);
  for (const entry of entries) assert.ok(xml.includes(`<loc>https://kutno.ru${entry.pathname}</loc>`));
});

test("robots открывает публичные страницы и указывает sitemap", async () => {
  const response = serveSeoRequest(new Request("https://kutno.ru/robots.txt"));
  assert.equal(response.status, 200);
  const text = await body(response);
  assert.match(text, /Allow: \//);
  assert.match(text, /Disallow: \/api\//);
  assert.match(text, /Sitemap: https:\/\/kutno\.ru\/sitemap\.xml/);
});

test("канонические URL не размножаются завершающим слешем", () => {
  const list = serveSeoRequest(new Request("https://kutno.ru/recipes/"));
  assert.equal(list.status, 301);
  assert.equal(list.headers.get("location"), "https://kutno.ru/recipes");

  const entry = seoRecipeEntries(2)[0];
  const recipe = serveSeoRequest(new Request(`https://kutno.ru${entry.pathname}/`));
  assert.equal(recipe.status, 301);
  assert.equal(recipe.headers.get("location"), `https://kutno.ru${entry.pathname}`);
});
