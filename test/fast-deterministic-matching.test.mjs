import assert from "node:assert/strict";
import test from "node:test";
import matchingWorker from "../worker/matching-entry.js";
import { loadRecipeBody, serveCatalogPage } from "../worker/catalog-page.js";

function generate(body) {
  return matchingWorker.fetch(new Request("https://kutno.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), {}, {});
}

test("обычный подбор работает без AI binding и возвращает лёгкие карточки", async () => {
  const response = await generate({
    ingredients: ["картофель", "лук", "яйца"],
    equipment: ["Сковорода", "Кастрюля"],
    searchMode: "strict",
    course: "все",
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.source, "deterministic-catalog");
  assert.ok(data.recipes.length >= 5);
  const titles = data.recipes.map((recipe) => recipe.title);
  assert.ok(titles.includes("Омлет"));
  assert.ok(titles.includes("Яичница-глазунья"));
  assert.ok(titles.includes("Жареная картошка с луком"));
  assert.ok(titles.includes("Отварной картофель"));
  assert.ok(data.recipes.every((recipe) => recipe.compact === true));
  assert.ok(data.recipes.every((recipe) => !("steps" in recipe)));
});

test("яйцо и яйца проходят одинаковый быстрый prefilter", async () => {
  const singular = await (await generate({ ingredients: ["яйцо"] })).json();
  const plural = await (await generate({ ingredients: ["яйца"] })).json();
  assert.deepEqual(
    singular.recipes.map((recipe) => recipe.id),
    plural.recipes.map((recipe) => recipe.id),
  );
});

test("одно яйцо не считается достаточным для омлета на четыре яйца", async () => {
  const data = await (await generate({
    ingredients: ["яйца", "картофель"],
    equipment: [],
    pantry: {
      яйца: { name: "яйца", quantity: 1, unit: "шт." },
      картофель: { name: "картофель", quantity: 800, unit: "г" },
    },
    course: "все",
  })).json();

  const omelette = data.recipes.find((recipe) => recipe.title === "Омлет");
  assert.ok(omelette, "близкий рецепт не должен исчезать из выдачи");
  assert.equal(omelette.matching?.group, "one");
  assert.ok(omelette.missing.includes("яйца"));
  assert.ok(omelette.matching?.quantityShortages?.some((item) => item.name === "яйца"));
});

test("подсказки показывают продукт, который открывает новые блюда", async () => {
  const response = await matchingWorker.fetch(new Request("https://kutno.test/api/matching-suggestions?ingredient=яйца&ingredient=картофель"), {}, {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(Array.isArray(data.suggestions));
  assert.ok(data.suggestions.length > 0);
  assert.ok(data.suggestions.every((item) => item.name && item.count > 0));
  assert.ok(data.suggestions.every((item) => !["яйца", "картофель"].includes(item.name.toLocaleLowerCase("ru-RU"))));
});

test("опасно большие и разметочные запросы отсекаются до matching CPU", async () => {
  const cases = [
    { ingredients: Array.from({ length: 200 }, (_, index) => `продукт${index}`) },
    { ingredients: ["<script>alert(1)</script>"] },
    { ingredients: ["яйца"], portions: 9999 },
    { ingredients: ["яйца"], course: "<b>x</b>" },
  ];
  for (const body of cases) {
    const response = await generate(body);
    assert.equal(response.status, 400);
  }
});

test("деталь рецепта масштабирует количества от базовых двух порций", async () => {
  const payload = {
    variants: {
      "2": {
        id: "simple:simple-omelette",
        title: "Омлет",
        portions: 2,
        servings: 2,
        ingredients: [
          { name: "яйца", amount: "4 шт." },
          { name: "вода", amount: "40 мл" },
          { name: "соль", amount: "по вкусу" },
        ],
        nutrition: { calories: 245, protein: 16, fat: 19, carbs: 1 },
      },
    },
  };
  const env = {
    ASSETS: {
      fetch: async () => Response.json(payload),
    },
  };
  const recipe = await loadRecipeBody(new Request("https://kutno.test/api/recipe/simple:simple-omelette"), env, "simple:simple-omelette", 8);
  assert.equal(recipe.portions, 8);
  assert.equal(recipe.servings, 8);
  assert.equal(recipe.ingredients[0].amount, "16 шт.");
  assert.equal(recipe.ingredients[1].amount, "160 мл");
  assert.equal(recipe.ingredients[2].amount, "по вкусу");
});

test("первая страница каталога остаётся меньше 16 КБ", async () => {
  const response = await serveCatalogPage(new Request("https://kutno.test/api/catalog?limit=5"), "size-test");
  const text = await response.text();
  const bytes = Buffer.byteLength(text, "utf8");
  assert.ok(bytes < 16_000, `первая страница слишком большая: ${bytes} байт`);
  const data = JSON.parse(text);
  assert.equal(data.recipes.length, 5);
});
