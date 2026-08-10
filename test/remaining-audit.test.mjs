import assert from "node:assert/strict";
import test from "node:test";
import matchingWorker from "../worker/matching-entry.js";
import { analyzeRecipe } from "../src/ingredient-semantics-v3.js";

async function generate(body) {
  const request = new Request("https://kutno.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await matchingWorker.fetch(request, {}, { waitUntil() {} });
  const text = await response.text();
  return { response, text, data: JSON.parse(text) };
}

const regressionSets = [
  ["яйца", "картошка", "лук"],
  ["курица", "рис", "морковь"],
  ["макароны", "сыр", "яйца"],
  ["картошка", "лук", "морковь", "масло"],
  ["помидоры", "огурцы", "сметана"],
  ["гречка", "лук", "морковь"],
  ["яйца", "молоко", "мука"],
  ["спагетти", "яйца", "сыр", "бекон"],
  ["хлеб", "сыр", "яйца", "масло"],
  ["капуста", "морковь", "лук", "картофель"],
  ["творог", "яйца", "мука", "сахар"],
  ["рис", "яйца", "лук", "морковь"],
  ["куриная грудка", "помидоры", "сыр"],
  ["фарш", "макароны", "томатная паста", "лук"],
  ["кабачки", "яйца", "мука", "чеснок"],
  ["яйца"],
  ["картошка"],
  ["яйца", "помидоры", "лук", "сыр", "хлеб", "масло", "молоко", "картошка"],
];

test("семантический матчинг учитывает aliases", () => {
  const analysis = analyzeRecipe({
    title: "Сырники",
    ingredients: [
      { name: "сухой творог", aliases: ["творог"] },
      { name: "яйцо", aliases: ["яйца"] },
      { name: "пшеничная мука", aliases: ["мука"] },
    ],
  }, { ingredients: ["творог", "яйца", "мука"] });
  assert.equal(analysis.requiredMissing.length, 0);
  assert.equal(analysis.exactAvailable.filter((item) => item.role !== "base").length, 3);
});

test("родственные названия яйца не создают ложный missing", () => {
  const analysis = analyzeRecipe({
    title: "Яичный соус",
    ingredients: [{ name: "яичный желток" }],
  }, { ingredients: ["яйца"] });
  assert.equal(analysis.requiredMissing.length, 0);
});

test("generate возвращает uses, coverage и ранжирует по продуктам пользователя", async () => {
  const { response, data } = await generate({ ingredients: ["яйца", "картошка", "лук"] });
  assert.equal(response.status, 200);
  assert.ok(data.recipes.length > 0);
  assert.ok(data.recipes.every((recipe) => Array.isArray(recipe.uses) && recipe.uses.length > 0));
  assert.ok(data.recipes.every((recipe) => recipe.usedCount === recipe.uses.length));
  assert.ok(data.recipes.every((recipe) => recipe.coverage >= 0 && recipe.coverage <= 1));
  assert.ok(data.recipes.slice(0, 3).some((recipe) => recipe.usedCount >= 2));
  const draniki = data.recipes.find((recipe) => /драник/i.test(recipe.title));
  assert.ok(draniki, "Драники должны попадать в первую страницу");
  assert.ok(draniki.uses.includes("картошка"));
});

test("сырники с алиасами входят в топ-3 без missing", async () => {
  const { data } = await generate({ ingredients: ["творог", "яйца", "мука", "сахар"] });
  const top = data.recipes.slice(0, 3);
  const syrniki = top.find((recipe) => /сырник/i.test(recipe.title));
  assert.ok(syrniki, `Сырники не найдены в топ-3: ${top.map((item) => item.title).join(", ")}`);
  assert.deepEqual(syrniki.missing, []);
  assert.ok(syrniki.usedCount >= 3);
});

test("generate отдаёт не больше 20 рецептов и честную пагинацию", async () => {
  const first = await generate({ ingredients: ["яйца", "картошка", "лук"] });
  assert.equal(first.response.status, 200);
  assert.ok(Buffer.byteLength(first.text, "utf8") < 40_000, `Ответ весит ${Buffer.byteLength(first.text, "utf8")} байт`);
  assert.ok(first.data.recipes.length <= 20);
  assert.ok(Number.isInteger(first.data.total));
  assert.equal(first.data.offset, 0);
  assert.equal(first.data.hasMore, first.data.total > first.data.recipes.length);

  if (first.data.hasMore) {
    const second = await generate({ ingredients: ["яйца", "картошка", "лук"], offset: 20 });
    assert.equal(second.data.offset, 20);
    const firstIds = new Set(first.data.recipes.map((recipe) => recipe.id));
    assert.ok(second.data.recipes.every((recipe) => !firstIds.has(recipe.id)));
  }
});

test("мусорный ввод не возвращает нерелевантные блюда", async () => {
  const { data } = await generate({ ingredients: ["асдфгх", "12345"] });
  assert.deepEqual(data.recipes, []);
  assert.ok(Array.isArray(data.suggestions) && data.suggestions.length > 0);
});

test("пустой ввод получает честный 400", async () => {
  const { response, data } = await generate({ ingredients: [] });
  assert.equal(response.status, 400);
  assert.match(data.error, /Добавьте хотя бы один продукт/i);
});

test("maxMinutes реально ограничивает выдачу", async () => {
  const { data } = await generate({ ingredients: ["яйца", "картошка", "лук"], maxMinutes: 15 });
  assert.ok(data.recipes.length > 0);
  assert.ok(data.recipes.every((recipe) => recipe.minutes <= 15));
});

test("enforceEquipment работает только по явному opt-in", async () => {
  const ingredients = ["яйца", "картошка", "лук"];
  const normal = await generate({ ingredients });
  const none = await generate({ ingredients, enforceEquipment: true, equipment: [] });
  const common = await generate({ ingredients, enforceEquipment: true, equipment: ["Сковородка", "Кастрюля"] });
  assert.ok(none.data.total < normal.data.total, `${none.data.total} должно быть меньше ${normal.data.total}`);
  assert.ok(common.data.total > none.data.total, `${common.data.total} должно быть больше ${none.data.total}`);
});

test("matching-suggestions использует ту же логику подсказок", async () => {
  const request = new Request("https://kutno.test/api/matching-suggestions?ingredient=яйца");
  const response = await matchingWorker.fetch(request, {}, { waitUntil() {} });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(data.suggestions));
  assert.ok(data.suggestions.length > 0);
});

test("18 контрольных наборов остаются непустыми", async () => {
  const failures = [];
  for (const ingredients of regressionSets) {
    const { data } = await generate({ ingredients });
    if (!Array.isArray(data.recipes) || !data.recipes.length) failures.push(ingredients.join(","));
  }
  assert.deepEqual(failures, []);
});
