import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { checkImageDirectory } from "../scripts/check-static-recipe-assets.mjs";
import { RECIPE_PHOTO_CATALOG, recipeHasPhoto } from "../worker/recipe-photo-catalog.js";
import { recipeImageUrls, recipePhotoManifest } from "../worker/recipe-images.js";
import { seoRecipeEntries } from "../worker/seo-pages.js";

test("public/img содержит ровно 119 полных троек валидных WebP", () => {
  const slugs = checkImageDirectory("public/img");
  assert.equal(slugs.size, 119);
});

test("фотокаталог содержит ровно 119 существующих рецептов и slug", () => {
  assert.equal(RECIPE_PHOTO_CATALOG.length, 119);
  assert.equal(new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.id)).size, 119);
  assert.equal(new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.slug)).size, 119);

  const entries = seoRecipeEntries(2);
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  for (const photo of RECIPE_PHOTO_CATALOG) {
    const recipe = bySlug.get(photo.slug);
    assert.ok(recipe, `missing recipe for ${photo.slug}`);
    assert.equal(recipe.id, photo.id, `${photo.slug}: recipe id mismatch`);
    assert.equal(recipeHasPhoto(recipe.recipe, recipe.slug), true, `${photo.slug}: recipeHasPhoto`);
    for (const ratio of ["1x1", "4x3", "16x9"]) {
      assert.equal(fs.existsSync(`public/img/${photo.slug}-${ratio}.webp`), true, `${photo.slug}: missing ${ratio}`);
    }
  }
});

test("manifest содержит те же 119 рецептов, а рецепты без фото не получают URL", () => {
  const manifest = recipePhotoManifest(2);
  assert.equal(manifest.length, 119);
  assert.deepEqual(new Set(manifest.map((entry) => entry.slug)), new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.slug)));

  const entries = seoRecipeEntries(2);
  const withoutPhoto = entries.find((entry) => !recipeHasPhoto(entry.recipe, entry.slug));
  assert.ok(withoutPhoto, "expected at least one recipe without an illustration");
  assert.deepEqual(recipeImageUrls(withoutPhoto.recipe, withoutPhoto.slug), []);
});
