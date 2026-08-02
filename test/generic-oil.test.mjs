import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecipe, ingredientMatch } from "../src/ingredient-semantics-v3.js";

test("общее масло считается растительным или подсолнечным", () => {
  assert.equal(ingredientMatch("масло", "растительное масло").type, "exact");
  assert.equal(ingredientMatch("масло для жарки", "подсолнечное масло").type, "exact");
});

test("сливочное и оливковое масло остаются отдельными продуктами", () => {
  assert.equal(ingredientMatch("сливочное масло", "растительное масло").type, "none");
  assert.equal(ingredientMatch("оливковое масло", "растительное масло").type, "substitute");
});

test("яичница с общим маслом доступна при базовом растительном масле", () => {
  const recipe = {
    title: "Яичница",
    ingredients: [
      { name: "яйца" },
      { name: "масло" },
      { name: "соль" },
    ],
    equipment: ["Сковорода"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["яйца"],
    baseIngredients: ["соль", "вода", "растительное масло", "сахар"],
    equipment: ["Сковорода"],
  });
  assert.equal(analysis.group, "ready");
  assert.equal(analysis.requiredMissing.length, 0);
});
