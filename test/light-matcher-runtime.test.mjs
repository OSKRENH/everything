import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = JSON.parse(readFileSync("public/recipe-data/catalog-runtime.json", "utf8"));
const matcher = readFileSync("worker/matching-entry.js", "utf8");
const routes = readFileSync("worker/routes.js", "utf8");

test("runtime содержит готовую семантику без построения словаря на edge", () => {
  assert.equal(runtime.recipes.length, 227);
  assert.ok(Object.keys(runtime.matching?.aliases || {}).length > 100);
  assert.ok(Array.isArray(runtime.matching?.semanticAliases) && runtime.matching.semanticAliases.length > 50);
  assert.ok(Object.keys(runtime.matching?.relations || {}).length > 20);
  assert.deepEqual(runtime.matching?.defaultBase, ["соль", "вода", "растительное масло", "сахар"]);
  assert.ok(runtime.recipes.every((recipe) => (recipe.ingredients || []).every((item) => Array.isArray(item.semanticIds) && item.semanticIds.length > 0)));
  assert.ok(runtime.recipes.every((recipe) => (recipe.ingredients || []).every((item) => ["required", "optional", "base"].includes(item.roleNoBase))));
});

test("горячий matcher не импортирует тяжёлый словарь, SEO или matching-user-context", () => {
  assert.match(matcher, /light-ingredient-semantics\.js/);
  assert.match(matcher, /light-matching-user-context\.js/);
  assert.doesNotMatch(matcher, /\.\.\/src\/ingredient-semantics-v3\.js/);
  assert.doesNotMatch(matcher, /\.\.\/src\/matching-user-context\.js/);
  assert.doesNotMatch(matcher, /\.\/recipe-images\.js/);
  assert.match(matcher, /loadRuntimeCatalog/);
});

test("общий route table лениво грузит тяжёлые route handlers", () => {
  for (const path of ["catalog-page.js", "public-app-pages.js", "fresh-sitemap.js", "lite-page.js", "recipe-images.js", "feature-state-migration.js"]) {
    assert.doesNotMatch(routes, new RegExp(`^import\\s+.*${path.replace(".", "\\.")}`, "m"));
    assert.match(routes, new RegExp(`import\\(\\"\\./${path.replace(".", "\\.")}\\"\\)`));
  }
});
