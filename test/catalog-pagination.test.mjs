import assert from "node:assert/strict";
import test from "node:test";
import { serveCatalogPage } from "../worker/catalog-page.js";
import { decodeCatalogCursor } from "../worker/catalog-cursor.js";

async function page(cursor = "", limit = 5) {
  const params = new URLSearchParams({ portions: "2", limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const response = await serveCatalogPage(new Request(`https://kutno.test/api/catalog?${params}`), "qa-request");
  assert.equal(response.status, 200);
  return response.json();
}

test("первая страница содержит пять карточек и метаданные всей базы", async () => {
  const first = await page();
  assert.equal(first.recipes.length, 5);
  assert.ok(first.total > first.recipes.length);
  assert.equal(first.index.length, first.total);
  assert.ok(first.nextCursor);
  assert.equal(decodeCatalogCursor(first.nextCursor), 5);
  assert.equal(first.page, 1);

  const cuisines = first.facets.cuisines.map((item) => item.value);
  assert.ok(cuisines.includes("Россия"));
  assert.ok(cuisines.includes("Италия"));
  assert.ok(cuisines.includes("Испания"));
  assert.ok(cuisines.length > new Set(first.recipes.map((recipe) => recipe.cuisine)).size);

  const second = await page(first.nextCursor);
  assert.equal("index" in second, false, "полный индекс не нужно повторять на каждой странице");
  assert.equal("facets" in second, false, "фильтры не нужно повторять на каждой странице");
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
