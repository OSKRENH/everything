import assert from "node:assert/strict";
import test from "node:test";
import { loadRecipeBody } from "../worker/catalog-page.js";
import { loadRuntimeRecipes } from "../worker/catalog-runtime-store.js";
import { runtimeEnv } from "./runtime-assets.mjs";

const pieceAmount = /^\d+(?:[.,]\d+)?\s*(?:шт\.?|зубч\.?|гол\.?)$/i;
const env = runtimeEnv();

test("штучные ингредиенты runtime-каталога не становятся дробными", async () => {
  let checked = 0;
  const recipes = await loadRuntimeRecipes(new Request("https://kutno.test/"));
  for (const recipe of recipes) {
    const full = await loadRecipeBody(new Request("https://kutno.test/"), env, recipe.id, 1);
    assert.ok(full, recipe.title);
    recipe.ingredients.forEach((raw, index) => {
      if (!pieceAmount.test(String(raw.amount || "").trim())) return;
      checked += 1;
      const amount = String(full.ingredients[index]?.amount || "");
      assert.match(amount, /^\d+\s/, `${recipe.title}: ${raw.name} → ${amount}`);
      assert.doesNotMatch(amount, /[,.]\d+/, `${recipe.title}: ${raw.name} → ${amount}`);
    });
  }
  assert.ok(checked > 0);
});

test("соль из pantry показывается как по вкусу", async () => {
  let checked = 0;
  const recipes = await loadRuntimeRecipes(new Request("https://kutno.test/"));
  for (const recipe of recipes) {
    const saltIndexes = recipe.ingredients.flatMap((raw, index) => raw.pantry === true && /соль/i.test(String(raw.name || "")) ? [index] : []);
    if (!saltIndexes.length) continue;
    const full = await loadRecipeBody(new Request("https://kutno.test/"), env, recipe.id, 2);
    assert.ok(full, recipe.title);
    for (const index of saltIndexes) {
      checked += 1;
      assert.equal(full.ingredients[index]?.amount, "по вкусу", `${recipe.title}: ${recipe.ingredients[index].name}`);
    }
  }
  assert.ok(checked > 0);
});
