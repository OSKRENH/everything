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
});

test("загрузочный текст не должен становиться поисковым сниппетом", () => {
  assert.match(index, /data-nosnippet>загрузка<\/span>/);
  assert.match(index, /data-kutno-shell-status[^>]*data-nosnippet/);
  assert.match(index, /class="boot-help" data-nosnippet/);
  assert.match(index, /Кутно подберёт подходящие рецепты/);
});

test("поисковый favicon использует стабильный квадратный PNG", () => {
  assert.match(index, /rel="icon" href="\/app-icon-192\.png" sizes="192x192" type="image\/png"/);
  assert.doesNotMatch(index, /rel="icon" href="\/favicon\.svg"/);
});
