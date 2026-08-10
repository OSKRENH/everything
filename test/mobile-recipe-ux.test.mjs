import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootstrap = readFileSync("src/bootstrap.js", "utf8");
const ux = readFileSync("public/mobile-recipe-ux.js", "utf8");
const css = readFileSync("public/mobile-recipe-ux.css", "utf8");

test("мобильный UX загружается до отложенных фото и функций", () => {
  assert.match(bootstrap, /mobile-recipe-ux\.css\?v=1/);
  assert.match(bootstrap, /await loadPublicModule\("\/mobile-recipe-ux\.js\?v=1"\)/);
  assert.match(bootstrap, /catalog-stability\.css\?v=4/);
});

test("открыватели рецептов превращаются в настоящие ссылки", () => {
  assert.match(ux, /document\.createElement\("a"\)/);
  assert.match(ux, /`\/recipe\/\$\{recipeSlug\(title\)\}`/);
  assert.match(ux, /role", "button"/);
  assert.match(ux, /window\.kutnoBridge\?\.openRecipe/);
  assert.match(ux, /kutno-recipe-photo-link/);
});

test("стрелка Поделиться принудительно остаётся текстовым символом", () => {
  assert.match(ux, /arrow\.textContent = "↗︎"/u);
  assert.doesNotMatch(ux, /↗️/u);
  assert.match(css, /font-variant-emoji:\s*text/);
});

test("открытый рецепт размывает фон, блокирует фон существующим no-scroll и держит close в viewport", () => {
  assert.match(css, /backdrop-filter:\s*blur\(10px\)/);
  assert.match(css, /\.sheet-close\s*\{[\s\S]*position:\s*fixed\s*!important/);
  assert.match(css, /height:\s*100svh\s*!important/);
  const mainCss = readFileSync("src/styles.css", "utf8");
  assert.match(mainCss, /\.no-scroll\s*\{\s*overflow:\s*hidden;\s*\}/);
});

test("мобильная кнопка продолжения каталога принудительно видима", () => {
  assert.match(css, /catalog-scroll-sentinel\.catalog-show-more-wrap[\s\S]*display:\s*flex\s*!important/);
  assert.match(css, /\.catalog-show-more[\s\S]*width:\s*100%\s*!important/);
  assert.match(ux, /data-catalog-show-more/);
});
