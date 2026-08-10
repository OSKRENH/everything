import assert from "node:assert/strict";
import test from "node:test";
import { serveCatalogIndex, serveCatalogPage, serveRecipeDetail } from "../worker/catalog-page.js";
import { decodeCatalogCursor } from "../worker/catalog-cursor.js";
import { runtimeEnv } from "./runtime-assets.mjs";

const env = runtimeEnv();

async function page(cursor = "", limit = 5) {
  const params = new URLSearchParams({ portions: "2", limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const response = await serveCatalogPage(new Request(`https://kutno.test/api/catalog?${params}`), "qa-request");
  assert.equal(response.status, 200);
  return response.json();
}

test("первая страница содержит пять лёгких карточек и полные фильтры", async () => {
  const first = await page();
  assert.equal(first.recipes.length, 5);
  assert.ok(first.total > first.recipes.length);
  assert.equal("index" in first, false, "полный индекс не должен тормозить первый экран");
  assert.ok(first.nextCursor);
  assert.equal(decodeCatalogCursor(first.nextCursor), 5);
  assert.equal(first.page, 1);
  assert.ok(first.recipes.every((recipe) => recipe.compact === true));
  assert.ok(first.recipes.every((recipe) => !("steps" in recipe)), "шаги загружаются только при открытии рецепта");
  assert.ok(first.recipes.every((recipe) => recipe.ingredients.every((item) => !("amount" in item))), "количества не нужны для карточки");

  const cuisines = first.facets.cuisines.map((item) => item.value);
  assert.ok(cuisines.includes("Домашняя кухня"));
  assert.ok(cuisines.includes("Италия"));
  assert.ok(cuisines.includes("Испания"));
  assert.ok(cuisines.length > new Set(first.recipes.map((recipe) => recipe.cuisine)).size);

  const second = await page(first.nextCursor);
  assert.equal("index" in second, false);
  assert.equal("facets" in second, false, "фильтры не нужно повторять на каждой странице");
});

test("индекс загружается отдельно и содержит всю базу", async () => {
  const response = await serveCatalogIndex(new Request("https://kutno.test/api/catalog-index"), "qa-index");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.index.length, data.total);
  assert.ok(data.index.some((recipe) => recipe.title === "Омлет"));
  assert.ok(data.index.some((recipe) => recipe.cuisine === "Япония"));
  assert.ok(data.index.every((recipe) => !("steps" in recipe)));
});

test("полный рецепт приходит только по id", async () => {
  const first = await page();
  const summary = first.recipes[0];
  const response = await serveRecipeDetail(new Request(`https://kutno.test/api/recipe/${encodeURIComponent(summary.id)}?portions=2`), env, "qa-detail");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.recipe.id, summary.id);
  assert.ok(Array.isArray(data.recipe.steps) && data.recipe.steps.length >= 2);
  assert.ok(data.recipe.ingredients.some((item) => item.amount));
  assert.equal(data.recipe.compact, undefined);
});

test("все страницы проходят каталог без повторов и пропусков", async () => {
  const ids = new Set();
  let cursor = "";
  let total = 0;
  let requests = 0;

  do {
    const current = await page(cursor, 5);
    total = current.total;
    for (const recipe of current.recipes) {
      const id = String(recipe.id || recipe.source?.id || recipe.title);
      assert.ok(id);
      assert.equal(ids.has(id), false, `повтор рецепта: ${id}`);
      ids.add(id);
    }
    cursor = current.nextCursor;
    requests += 1;
    assert.ok(requests < 100, "курсор не должен зацикливаться");
  } while (cursor);

  assert.equal(ids.size, total);
  assert.ok(requests > 1);
});

test("повреждённый курсор безопасно открывает первую страницу", async () => {
  const current = await page("сломанный-курсор");
  assert.equal(current.page, 1);
  assert.equal(current.recipes.length, 5);
});
