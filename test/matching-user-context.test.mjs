import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecipe, ingredientMatch } from "../src/ingredient-semantics-v3.js";
import {
  applyMatchingUserContext,
  parseMatchingAmount,
  preferencePenaltyForRecipe,
} from "../src/matching-user-context.js";

const eggRecipe = {
  id: "egg-four",
  title: "Омлет из четырёх яиц",
  cuisine: "Франция",
  course: "завтрак",
  protein: "без мяса",
  minutes: 12,
  difficulty: "легко",
  ingredients: [
    { name: "яйца", amount: "4 шт." },
    { name: "молоко", amount: "100 мл" },
    { name: "растительное масло", amount: "1 ч. л.", pantry: true },
    { name: "соль", amount: "по вкусу", pantry: true },
  ],
  equipment: ["Сковорода"],
};

function analyze(context = {}) {
  const semantic = analyzeRecipe(eggRecipe, {
    ingredients: ["яйца", "молоко"],
    equipment: ["pan"],
    baseIngredients: ["соль", "вода", "растительное масло", "сахар"],
  });
  return applyMatchingUserContext(eggRecipe, semantic, context);
}

test("количество понимает массу, объём, штуки и дроби", () => {
  assert.deepEqual(parseMatchingAmount("1,5 кг"), { value: 1500, family: "mass", unit: "кг" });
  assert.deepEqual(parseMatchingAmount("2 ст. л."), { value: 30, family: "volume", unit: "ст. л." });
  assert.deepEqual(parseMatchingAmount("½ шт."), { value: 0.5, family: "count", unit: "шт." });
});

test("одно яйцо не считается достаточным для рецепта на четыре", () => {
  const result = analyze({
    pantry: {
      яйца: { name: "яйца", quantity: 1, unit: "шт." },
      молоко: { name: "молоко", quantity: 200, unit: "мл" },
    },
  });
  assert.equal(result.group, "one");
  assert.equal(result.quantityShortages.length, 1);
  assert.equal(result.requiredMissing[0].name, "яйца");
  assert.match(result.reasons[0], /есть 1 шт.*нужно 4 шт/u);
});

test("достаточный запас оставляет рецепт готовым", () => {
  const result = analyze({
    pantry: {
      яйца: { name: "яйца", quantity: 6, unit: "шт." },
      молоко: { name: "молоко", quantity: 200, unit: "мл" },
    },
  });
  assert.equal(result.group, "ready");
  assert.equal(result.quantityShortages.length, 0);
  assert.equal(result.quantityEnough.length, 2);
});

test("отказ от продукта штрафует рецепт в основном рейтинге", () => {
  const penalty = preferencePenaltyForRecipe(eggRecipe, [{
    recipeId: "other",
    title: "Другое блюдо",
    reason: "dislike-ingredient",
    ingredient: "молоко",
    at: Date.now(),
  }]);
  assert.ok(penalty >= 170);
  const result = analyze({ feedback: [{ reason: "dislike-ingredient", ingredient: "молоко", at: Date.now() }] });
  assert.ok(result.preferencePenalty >= 170);
});

test("похожее чаще поднимает блюда той же кухни и категории", () => {
  const penalty = preferencePenaltyForRecipe(eggRecipe, [{
    recipeId: "liked",
    title: "Другой французский завтрак",
    reason: "more-like-this",
    cuisine: "Франция",
    course: "завтрак",
    protein: "без мяса",
    ingredients: ["яйца", "молоко"],
    at: Date.now(),
  }]);
  assert.ok(penalty < 0);
});

test("бытовые формулировки и распространённые варианты совпадают", () => {
  assert.equal(ingredientMatch("лосось", "филе сёмги").type, "exact");
  assert.equal(ingredientMatch("помидоры", "томаты черри").type, "exact");
  assert.equal(ingredientMatch("макароны", "макаронные изделия").type, "exact");
  assert.equal(ingredientMatch("чеснок", "зубчик чеснока").type, "exact");
});
