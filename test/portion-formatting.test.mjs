import assert from "node:assert/strict";
import test from "node:test";
import { catalogSources, fullRecipeForSource } from "../worker/catalog-page.js";

const pieceUnit = /^(?:шт\.?|зубч\.?|гол\.?)$/i;

test("штучные ингредиенты мирового каталога не становятся дробными", () => {
  let checked = 0;
  for (const source of catalogSources(1).filter((item) => item.kind === "world")) {
    const full = fullRecipeForSource(source, 1);
    source.recipe.ingredients.forEach((raw, index) => {
      if (typeof raw.amount !== "number" || !pieceUnit.test(String(raw.unit || "").trim())) return;
      checked += 1;
      const amount = String(full.ingredients[index]?.amount || "");
      assert.match(amount, /^\d+\s/, `${source.recipe.title}: ${raw.name} → ${amount}`);
      assert.doesNotMatch(amount, /[,.]\d+/, `${source.recipe.title}: ${raw.name} → ${amount}`);
    });
  }
  assert.ok(checked > 0);
});

test("числовая соль из pantry показывается как по вкусу", () => {
  let checked = 0;
  for (const source of catalogSources(2).filter((item) => item.kind === "world")) {
    const full = fullRecipeForSource(source, 2);
    source.recipe.ingredients.forEach((raw, index) => {
      if (typeof raw.amount !== "number" || raw.pantry !== true || !/соль/i.test(String(raw.name || ""))) return;
      checked += 1;
      assert.equal(full.ingredients[index]?.amount, "по вкусу", `${source.recipe.title}: ${raw.name}`);
    });
  }
  assert.ok(checked > 0);
});
