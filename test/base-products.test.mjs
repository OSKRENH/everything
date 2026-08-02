import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRecipe,
  DEFAULT_BASE_INGREDIENTS,
  SUGGESTED_BASE_INGREDIENTS,
} from "../src/ingredient-semantics-v2.js";

test("по умолчанию базовыми считаются только соль, вода и растительное масло", () => {
  assert.deepEqual(DEFAULT_BASE_INGREDIENTS, ["соль", "вода", "растительное масло"]);
  assert.ok(!DEFAULT_BASE_INGREDIENTS.some((item) => /оливков/i.test(item)));
});

test("оливковое масло не считается базовым и использует растительное только как замену", () => {
  const recipe = {
    title: "Капрезе",
    ingredients: [
      { name: "помидоры" },
      { name: "моцарелла" },
      { name: "оливковое масло", pantry: true },
    ],
    equipment: ["Нож"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["помидоры", "моцарелла"],
    equipment: [],
  });
  assert.equal(analysis.group, "substitute");
  assert.equal(analysis.substitutions.length, 1);
  assert.equal(analysis.substitutions[0].name, "оливковое масло");
  assert.equal(analysis.substitutions[0].match.owned, "растительное масло");
});

test("чёрный перец без подтверждения остаётся необязательным", () => {
  const recipe = {
    title: "Овощной салат",
    ingredients: [
      { name: "помидоры" },
      { name: "огурец" },
      { name: "чёрный перец", pantry: true },
    ],
    equipment: ["Нож", "Миска"],
  };
  const analysis = analyzeRecipe(recipe, {
    ingredients: ["помидоры", "огурец"],
    equipment: [],
  });
  assert.equal(analysis.group, "substitute");
  assert.equal(analysis.optionalMissing[0].name, "чёрный перец");
});

test("расширенную бакалею можно включить вручную", () => {
  assert.ok(SUGGESTED_BASE_INGREDIENTS.includes("чёрный перец"));
  assert.ok(SUGGESTED_BASE_INGREDIENTS.includes("сахар"));
  assert.ok(SUGGESTED_BASE_INGREDIENTS.includes("пшеничная мука"));
  assert.ok(SUGGESTED_BASE_INGREDIENTS.includes("уксус"));
  assert.ok(!SUGGESTED_BASE_INGREDIENTS.some((item) => /оливков/i.test(item)));
});
