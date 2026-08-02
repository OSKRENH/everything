import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRecipe,
  ingredientMatch,
  ingredientRole,
} from "../src/ingredient-semantics-v2.js";

test("синонимы считаются точным совпадением", () => {
  assert.equal(ingredientMatch("помидоры", "томаты").type, "exact");
  assert.equal(ingredientMatch("картофель", "картошка").type, "exact");
});

test("репчатый и зелёный лук не считаются одним продуктом", () => {
  assert.equal(ingredientMatch("репчатый лук", "зелёный лук").type, "none");
});

test("кокосовое и обычное молоко не считаются одним продуктом", () => {
  assert.equal(ingredientMatch("молоко", "кокосовое молоко").type, "none");
  assert.equal(ingredientMatch("кокосовое молоко", "кокосовое молоко").type, "exact");
});

test("частный вид подходит общей категории, но обратное считается заменой", () => {
  assert.equal(ingredientMatch("макароны", "спагетти").type, "category");
  assert.equal(ingredientMatch("спагетти", "макароны").type, "substitute");
  assert.equal(ingredientMatch("пармезан", "твёрдый сыр").type, "substitute");
});

test("базовые продукты не блокируют рецепт", () => {
  const recipe = {
    title: "Жареный картофель",
    ingredients: [
      { name: "картофель" },
      { name: "растительное масло", pantry: true },
      { name: "соль", pantry: true },
    ],
    equipment: ["Сковорода"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["картошка"],
    equipment: ["pan"],
  });
  assert.equal(analysis.group, "ready");
  assert.equal(analysis.requiredMissing.length, 0);
});

test("пустой список техники означает отсутствие техники", () => {
  const recipe = {
    title: "Жареный картофель",
    ingredients: [{ name: "картофель" }],
    equipment: ["Сковорода"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["картофель"],
    equipment: [],
  });
  assert.equal(analysis.group, "more");
  assert.deepEqual(analysis.missingEquipment, ["Сковорода"]);
});

test("необязательная зелень не переводит рецепт в покупки", () => {
  const recipe = {
    title: "Спагетти с чесноком",
    ingredients: [
      { name: "спагетти" },
      { name: "чеснок" },
      { name: "оливковое масло", pantry: true },
      { name: "петрушка" },
    ],
    equipment: ["Кастрюля", "Сковорода"],
  };
  assert.equal(ingredientRole(recipe.ingredients[3], recipe, 3), "optional");
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["спагетти", "чеснок"],
    equipment: ["pot", "pan"],
  });
  assert.equal(analysis.group, "substitute");
  assert.equal(analysis.requiredMissing.length, 0);
  assert.equal(analysis.optionalMissing[0].name, "петрушка");
});

test("один отсутствующий главный продукт попадает в отдельную группу", () => {
  const recipe = {
    title: "Курица с рисом",
    ingredients: [
      { name: "курица" },
      { name: "рис" },
      { name: "репчатый лук" },
      { name: "соль", pantry: true },
    ],
    equipment: ["Кастрюля"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["рис", "лук"],
    equipment: ["pot"],
  });
  assert.equal(analysis.group, "one");
  assert.deepEqual(analysis.requiredMissing.map((item) => item.name), ["курица"]);
});

test("приоритетный продукт заметно повышает рейтинг", () => {
  const recipe = {
    title: "Гречка с грибами",
    ingredients: [
      { name: "гречка" },
      { name: "грибы" },
      { name: "репчатый лук" },
    ],
    equipment: ["Кастрюля", "Сковорода"],
  };
  const common = { ingredients: ["гречка", "грибы", "лук"], equipment: ["pot", "pan"] };
  const withoutPriority = analyzeRecipe(recipe, common);
  const withPriority = analyzeRecipe(recipe, { ...common, priorityIngredients: ["грибы"] });
  assert.ok(withPriority.score > withoutPriority.score);
  assert.deepEqual(withPriority.priorityHits, ["грибы"]);
});
