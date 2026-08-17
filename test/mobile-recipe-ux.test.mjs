import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootstrap = readFileSync("src/bootstrap.js", "utf8");
const ux = readFileSync("src/mobile-recipe-ux.js", "utf8");
const css = readFileSync("src/mobile-recipe-ux.css", "utf8");
const appStyles = readFileSync("src/app-styles.css", "utf8");
const catalogScroll = readFileSync("src/catalog-scroll-fill.inject.js", "utf8");

test("мобильный UX загружается до отложенных фото и функций", () => {
  // mobile-recipe-ux.js/.css are bundled with the main app chunk (imported from bootstrap.js /
  // app-styles.css) rather than fetched as separate <link>/<script> requests, so this checks the
  // import wiring instead of a runtime URL. It stays ahead of the idle-callback-deferred extras
  // (kutno-features.js, recipe-photos.js) in loadExtras below.
  assert.match(appStyles, /@import "\.\/mobile-recipe-ux\.css";/);
  // Static import (not a dynamic import() call) so Vite bundles it straight into the entry
  // chunk instead of splitting it into a separately-fetched file.
  assert.match(bootstrap, /^import "\.\/mobile-recipe-ux\.js";/m);
  assert.ok(
    bootstrap.indexOf('import "./mobile-recipe-ux.js";') < bootstrap.indexOf("loadExtras"),
    "mobile-recipe-ux.js должен грузиться до объявления loadExtras (отложенных фото и функций)",
  );
  assert.match(appStyles, /@import "\.\/catalog-stability\.css";/);
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

test("большой загрузчик центрирован, а AM-иллюстрация на мобильном идёт под текстом и приглушена", () => {
  assert.match(css, /\.pot-loader-large\s*\{[\s\S]*margin:\s*24px auto 0\s*!important/);
  assert.match(css, /\.swipe-heading\s*>\s*\.swipe-illustration\s*\{[\s\S]*order:\s*4/);
  assert.match(css, /\.swipe-heading\s*>\s*\.swipe-illustration img\s*\{[\s\S]*max-height:\s*180px[\s\S]*opacity:\s*\.5/);
});

test("мобильная кнопка продолжения каталога принудительно видима", () => {
  assert.match(css, /catalog-scroll-sentinel\.catalog-show-more-wrap[\s\S]*display:\s*flex\s*!important/);
  assert.match(css, /\.catalog-show-more[\s\S]*width:\s*100%\s*!important/);
  assert.match(ux, /data-catalog-show-more/);
});

test("на мобильном каталог раскрывается по пять карточек с плавной пакетной анимацией", () => {
  assert.match(catalogScroll, /max-width:\s*700px[\s\S]*return 5/);
  assert.match(catalogScroll, /function animateCatalogBatchV9/);
  assert.match(catalogScroll, /cards\.slice\(Math\.max\(0, startIndex\)\)/);
  assert.match(catalogScroll, /animationDelay = `\$\{Math\.min\(index, 6\) \* 65\}ms`/);
  assert.match(catalogScroll, /animateCatalogBatchV9\(previousVisible\)/);
});
