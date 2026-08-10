import assert from "node:assert/strict";
import test from "node:test";
import matchingWorker from "../worker/matching-entry.js";
import { serveCatalogPage } from "../worker/catalog-page.js";

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

test("первая страница каталога остаётся меньше 16 КБ", async () => {
  const response = await serveCatalogPage(new Request("https://kutno.test/api/catalog?limit=5"), "size-test");
  const text = await response.text();
  const bytes = Buffer.byteLength(text, "utf8");
  assert.ok(bytes < 16_000, `первая страница слишком большая: ${bytes} байт`);
  const data = JSON.parse(text);
  assert.equal(data.recipes.length, 5);
});
