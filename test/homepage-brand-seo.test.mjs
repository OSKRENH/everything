import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync("index.html", "utf8");

test("главная явно сообщает поисковикам бренд Кутно", () => {
  assert.match(index, /<title>Кутно — рецепты из продуктов, которые есть дома<\/title>/);
  assert.match(index, /name="description" content="Кутно подбирает рецепты по продуктам/);
  assert.match(index, /"@type": "WebSite"/);
  assert.match(index, /"name": "Кутно"/);
  assert.match(index, /"alternateName": \["Кутно рецепты", "kutno\.ru"\]/);
  assert.match(index, /"url": "https:\/\/kutno\.ru\/"/);
  assert.match(index, /property="og:image" content="https:\/\/kutno\.ru\/app-icon-512\.png"/);
  assert.match(index, /name="twitter:image" content="https:\/\/kutno\.ru\/app-icon-512\.png"/);
  assert.match(index, /"@type": "WebApplication"/);
  assert.match(index, /"price": "0"/);
});

test("главная содержит прямую индексируемую ссылку на базу рецептов", () => {
  assert.match(index, /<a href="\/recipes">база рецептов<\/a>/);
  assert.match(index, /<a href="\/recipes">Посмотреть всю базу рецептов<\/a>/);
});

test("главная содержит полезный HTML даже до запуска JavaScript", () => {
  assert.match(index, /<div class="boot-seo-content" data-seo-content>\s*<section/);
  assert.match(index, /<h2>Рецепты из ваших продуктов<\/h2>/);
  assert.match(index, /Кутно сопоставит их с базой рецептов/);
});

test("загрузочный текст не должен становиться поисковым сниппетом", () => {
  assert.match(index, /data-nosnippet>загрузка<\/span>/);
  assert.match(index, /data-kutno-shell-status[^>]*data-nosnippet/);
  assert.match(index, /class="boot-help" data-nosnippet/);
  assert.match(index, /Кутно подберёт подходящие рецепты/);
});

test("поисковый favicon явно объявляет SVG и PNG fallback", () => {
  assert.match(index, /rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
  assert.match(index, /rel="icon" href="\/app-icon-192\.png" sizes="192x192" type="image\/png"/);
});
