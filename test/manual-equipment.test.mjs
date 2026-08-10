import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecipe, MANUAL_EQUIPMENT } from "../src/ingredient-semantics-v2.js";
import { manualRecipesForPortions } from "../worker/manual-recipes.js";

test("ручные инструменты доступны даже при пустом выборе техники", () => {
  assert.ok(MANUAL_EQUIPMENT.includes("нож"));
  assert.ok(MANUAL_EQUIPMENT.includes("миска"));

  const recipe = {
    title: "Овощной салат",
    ingredients: [
      { name: "помидоры" },
      { name: "огурец" },
      { name: "соль", pantry: true },
    ],
    equipment: ["Нож", "Миска"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["томаты", "огурец"],
    equipment: [],
  });
  assert.equal(analysis.group, "ready");
  assert.deepEqual(analysis.missingEquipment, []);
});

test("пустой выбор техники не запрещает плиту или духовку", () => {
  const recipe = {
    title: "Жареные овощи",
    ingredients: [{ name: "помидоры" }, { name: "огурец" }],
    equipment: ["Сковорода"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["помидоры", "огурец"],
    equipment: [],
  });
  assert.equal(analysis.group, "ready");
  assert.deepEqual(analysis.missingEquipment, []);
});

test("явный фильтр техники может запрещать отсутствующую сковороду", () => {
  const recipe = {
    title: "Жареные овощи",
    ingredients: [{ name: "помидоры" }, { name: "огурец" }],
    equipment: ["Сковорода"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["помидоры", "огурец"],
    equipment: [],
    enforceEquipment: true,
  });
  assert.equal(analysis.group, "more");
  assert.deepEqual(analysis.missingEquipment, ["Сковорода"]);
});

test("ручные инструменты остаются доступными при явном фильтре техники", () => {
  const recipe = {
    title: "Сэндвич",
    ingredients: [{ name: "хлеб" }, { name: "сыр" }],
    equipment: ["Нож", "Руки"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["хлеб", "твёрдый сыр"],
    equipment: ["блендер"],
    enforceEquipment: true,
  });
  assert.equal(analysis.group, "ready");
});

test("ручной каталог содержит салаты и сэндвичи", () => {
  const recipes = manualRecipesForPortions(2);
  assert.ok(recipes.length >= 10);
  assert.ok(recipes.some((recipe) => /салат/i.test(recipe.title)));
  assert.ok(recipes.some((recipe) => /сэндвич/i.test(recipe.title)));
  assert.ok(recipes.every((recipe) => recipe.source?.type === "kutno-manual-catalog"));
  assert.ok(recipes.every((recipe) => !recipe.equipment.some((item) => /сковород|кастрюл|духов|блендер|микроволн/i.test(item))));
});
