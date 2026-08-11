import assert from "node:assert/strict";
import test from "node:test";
import { checkImageDirectory } from "../scripts/check-static-recipe-assets.mjs";
import { RECIPE_PHOTO_CATALOG, recipeHasPhoto } from "../worker/recipe-photo-catalog.js";
import { recipeImageUrls, recipePhotoManifest } from "../worker/recipe-images.js";
import { seoRecipeEntries } from "../worker/seo-pages.js";

test("public/img содержит 227 полных статических набора WebP", () => {
  const slugs = checkImageDirectory("public/img");
  assert.equal(slugs.size, 227);
});

test("фотокаталог содержит 227 уникальных id/slug", () => {
  assert.equal(RECIPE_PHOTO_CATALOG.length, 227);
  assert.equal(new Set(RECIPE_PHOTO_CATALOG.map((item) => item.id)).size, 227);
  assert.equal(new Set(RECIPE_PHOTO_CATALOG.map((item) => item.slug)).size, 227);
});

test("фотокаталог полностью покрывает runtime SEO-каталог", () => {
  const entries = seoRecipeEntries(2);
  const photos = recipePhotoManifest(2);
  assert.equal(entries.length, 227);
  assert.equal(photos.length, 227);
  assert.ok(entries.every((entry) => recipeHasPhoto(entry.recipe, entry.slug)));
  for (const entry of entries) assert.equal(recipeImageUrls(entry.recipe, entry.slug).length, 3);
});
