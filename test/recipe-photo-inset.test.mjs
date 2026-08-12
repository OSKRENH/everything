import assert from "node:assert/strict";
import test from "node:test";
import { recipePhotoManifest } from "../worker/recipe-images.js";

test("только новые 108 иллюстраций получают inset-разметку", () => {
  const manifest = recipePhotoManifest(2);
  const inset = manifest.filter((item) => item.inset === true);

  assert.equal(manifest.length, 227);
  assert.equal(inset.length, 108);
  assert.equal(manifest.find((item) => item.slug === "omlet")?.inset, false);
  assert.equal(manifest.find((item) => item.slug === "pomidory-s-yaytsom-po-kitayski")?.inset, true);
  assert.equal(manifest.find((item) => item.slug === "yaichnitsa-glazunya")?.inset, true);
});
