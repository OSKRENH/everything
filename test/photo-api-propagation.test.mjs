import assert from "node:assert/strict";
import test from "node:test";
import { serveCatalogIndex, serveCatalogPage } from "../worker/catalog-page.js";
import { recipePhotoManifest } from "../worker/recipe-images.js";
import { dispatchRoute } from "../worker/routes.js";

function assertPhotoSet(recipe) {
  assert.equal(recipe.hasPhoto, true);
  assert.ok(recipe.photo && typeof recipe.photo === "object");
  assert.match(recipe.photo.square, /^https:\/\/kutno\.ru\/img\/[a-z0-9-]+-1x1\.webp$/);
  assert.match(recipe.photo.page, /^https:\/\/kutno\.ru\/img\/[a-z0-9-]+-4x3\.webp$/);
  assert.match(recipe.photo.social, /^https:\/\/kutno\.ru\/img\/[a-z0-9-]+-16x9\.webp$/);
}

test("catalog-index отдаёт ровно 119 рецептов с рабочим photo set", async () => {
  const response = await serveCatalogIndex(new Request("https://kutno.test/api/catalog-index"), "photo-index");
  assert.equal(response.status, 200);
  const data = await response.json();
  const manifest = recipePhotoManifest(2);
  const withPhoto = data.index.filter((recipe) => recipe.hasPhoto === true);
  assert.equal(manifest.length, 119);
  assert.equal(withPhoto.length, manifest.length);
  withPhoto.forEach(assertPhotoSet);

  const withoutPhoto = data.index.find((recipe) => recipe.hasPhoto === false);
  assert.ok(withoutPhoto, "в базе должен оставаться рецепт без загруженной фотографии");
  assert.equal(withoutPhoto.photo, null);
});

test("все страницы /api/catalog совпадают с photo-manifest", async () => {
  const all = [];
  let cursor = "";
  let guard = 0;
  do {
    const params = new URLSearchParams({ limit: "12" });
    if (cursor) params.set("cursor", cursor);
    const response = await serveCatalogPage(new Request(`https://kutno.test/api/catalog?${params}`), "photo-page");
    assert.equal(response.status, 200);
    const data = await response.json();
    all.push(...data.recipes);
    cursor = data.nextCursor || "";
    guard += 1;
    assert.ok(guard < 40, "каталог не должен зациклиться");
  } while (cursor);

  const manifest = recipePhotoManifest(2);
  const withPhoto = all.filter((recipe) => recipe.hasPhoto === true);
  assert.equal(withPhoto.length, manifest.length);
  withPhoto.forEach(assertPhotoSet);
  assert.ok(all.filter((recipe) => recipe.hasPhoto === false).every((recipe) => recipe.photo === null));
});

test("/api/generate возвращает photo set для найденного рецепта с иллюстрацией", async () => {
  const request = new Request("https://kutno.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ingredients: ["творог", "яйца", "мука", "сахар"] }),
  });
  const routed = await dispatchRoute(request, {}, {}, "photo-generate");
  assert.equal(routed.label, "generate");
  assert.equal(routed.response.status, 200);
  const data = await routed.response.json();
  const syrniki = data.recipes.find((recipe) => recipe.title === "Сырники");
  assert.ok(syrniki, "Сырники должны оставаться в детерминированной выдаче");
  assertPhotoSet(syrniki);
  assert.equal(syrniki.photo.page, "https://kutno.ru/img/syrniki-4x3.webp");
});
