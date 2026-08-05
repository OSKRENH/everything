import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const source = readFileSync("src/swipe-full-catalog.inject.js", "utf8");
const vite = readFileSync("vite.config.js", "utf8");

test("логика полной колоды АМ проходит синтаксическую проверку", () => {
  const result = spawnSync(process.execPath, ["--check", "src/swipe-full-catalog.inject.js"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("АМ догружает страницы каталога и не использует фильтр продуктов", () => {
  assert.match(source, /while \(catalogNextCursor/);
  assert.match(source, /loadNextCatalogPage\(\)/);
  assert.match(source, /resetSwipeDeck\(\)/);
  assert.doesNotMatch(source, /state\.ingredients/);
  assert.doesNotMatch(source, /state\.equipment/);
});

test("Vite подключает полную колоду после каталога", () => {
  assert.match(vite, /swipe-full-catalog\.inject\.js/);
  assert.ok(vite.indexOf("catalogFacetsSource") < vite.lastIndexOf("swipeFullCatalogSource"));
});
