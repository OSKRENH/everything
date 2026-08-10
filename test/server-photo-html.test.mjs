import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { servePublicAppPage } from "../worker/public-app-pages.js";
import { recipeHasPhoto } from "../worker/recipe-photo-catalog.js";
import { seoRecipeEntries } from "../worker/seo-pages.js";
import { runtimeEnv } from "./runtime-assets.mjs";

const env = runtimeEnv(readFileSync("index.html", "utf8"), { STRICT_SEO_MARKERS: "true" });

test("серверный HTML рецепта содержит 4:3 hero до ингредиентов без lazy", async () => {
  const entry = seoRecipeEntries().find((item) => item.slug === "syrniki");
  assert.ok(entry);
  const response = await servePublicAppPage(new Request(`https://kutno.ru${entry.pathname}`), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  const hero = html.match(/<img class="seo-recipe-hero"[^>]*>/)?.[0] || "";
  assert.ok(hero, "hero должен присутствовать в исходном HTML");
  assert.match(hero, /src="https:\/\/kutno\.ru\/img\/syrniki-4x3\.webp"/);
  assert.match(hero, /width="1200"/);
  assert.match(hero, /height="900"/);
  assert.match(hero, /fetchpriority="high"/);
  assert.match(hero, /decoding="async"/);
  assert.doesNotMatch(hero, /loading=/);
  assert.ok(html.indexOf(hero) < html.indexOf("<h2>Ингредиенты</h2>"));
});

test("серверный /recipes содержит квадратные lazy-превью", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipes"), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  const preview = html.match(/<img class="seo-recipe-preview"[^>]*syrniki-1x1\.webp[^>]*>/)?.[0] || "";
  assert.ok(preview, "превью сырников должно присутствовать в исходном HTML каталога");
  assert.match(preview, /width="1200"/);
  assert.match(preview, /height="1200"/);
  assert.match(preview, /loading="lazy"/);
  assert.match(preview, /decoding="async"/);
});

test("рецепт без фото не получает серверный img", async () => {
  const entry = seoRecipeEntries().find((item) => !recipeHasPhoto(item.recipe, item.slug));
  assert.ok(entry);
  const response = await servePublicAppPage(new Request(`https://kutno.ru${entry.pathname}`), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.doesNotMatch(html, /class="seo-recipe-hero"/);
});
