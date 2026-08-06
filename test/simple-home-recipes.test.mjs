import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRecipe,
  DEFAULT_BASE_INGREDIENTS,
} from "../src/ingredient-semantics-v3.js";
import { simpleRecipesForPortions } from "../worker/simple-recipes.js";

const context = {
  ingredients: ["картофель", "лук", "яйца"],
  priorityIngredients: [],
  equipment: [
    "Сковорода",
    "Кастрюля",
    "Нож",
    "Разделочная доска",
    "Миска",
    "Вилка",
    "Тёрка",
  ],
  baseIngredients: DEFAULT_BASE_INGREDIENTS,
};

test("картофель, лук и яйца дают ожидаемые простые блюда", () => {
  const recipes = simpleRecipesForPortions(2);
  const available = recipes
    .filter((recipe) => ["ready", "substitute"].includes(analyzeRecipe(recipe, context).group))
    .map((recipe) => recipe.title);

  for (const title of [
    "Омлет",
    "Яичница-глазунья",
    "Яичница с луком",
    "Яйца вкрутую",
    "Жареная картошка с луком",
    "Отварной картофель",
    "Картофельное пюре",
    "Картофельный салат с яйцом",
    "Драники",
  ]) {
    assert.ok(available.includes(title), `ожидался рецепт «${title}»`);
  }
});

test("простые рецепты масштабируются по числу порций", () => {
  const [twoPortions] = simpleRecipesForPortions(2);
  const [fourPortions] = simpleRecipesForPortions(4);

  assert.equal(twoPortions.portions, 2);
  assert.equal(fourPortions.portions, 4);
  assert.equal(twoPortions.source.type, "kutno-simple-catalog");
  assert.notEqual(twoPortions.ingredients[0].amount, fourPortions.ingredients[0].amount);
});
