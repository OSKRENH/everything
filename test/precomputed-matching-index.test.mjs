import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import matchingWorker from "../worker/matching-entry.js";

const matcher = readFileSync("worker/matching-entry.js", "utf8");
const generator = readFileSync("scripts/generate-recipe-runtime.mjs", "utf8");
const runtime = JSON.parse(readFileSync("public/recipe-data/catalog-runtime.json", "utf8"));

function generate(ingredients) {
  return matchingWorker.fetch(new Request("https://kutno.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ingredients }),
  }), {}, {});
}

test("runtime хранит готовый быстрый индекс для каждого рецепта", () => {
  assert.equal(runtime.recipes.length, 227);
  assert.ok(runtime.recipes.every((recipe) => Array.isArray(recipe.matchTerms) && recipe.matchTerms.length > 0));
  assert.ok(runtime.recipes.every((recipe) => Array.isArray(recipe.matchPrefixes)));
  assert.ok(runtime.recipes.every((recipe) => recipe.matchTerms.every((term) => typeof term === "string" && term.length > 0)));
});

test("нормализация индекса выполняется при сборке, а не лениво на запросе", () => {
  assert.match(generator, /precomputedMatchIndex/);
  assert.match(generator, /matchTerms: matchIndex\.terms/);
  assert.match(generator, /matchPrefixes: matchIndex\.prefixes/);
  assert.match(matcher, /recipe\?\.matchTerms/);
  assert.match(matcher, /recipe\?\.matchPrefixes/);
  assert.doesNotMatch(matcher, /FAST_RECIPE_PROFILE_CACHE/);
  assert.doesNotMatch(matcher, /function fastRecipeProfile/);
});

test("предвычисленный индекс сохраняет основной подбор и нормализацию яйца", async () => {
  const regular = await (await generate(["яйца", "картошка", "лук"])).json();
  assert.ok(regular.recipes.length > 0);
  assert.equal(regular.recipes[0]?.title, "Драники");

  const singular = await (await generate(["яйцо"])).json();
  const plural = await (await generate(["яйца"])).json();
  assert.deepEqual(singular.recipes.map((recipe) => recipe.id), plural.recipes.map((recipe) => recipe.id));
});
