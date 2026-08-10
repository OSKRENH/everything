import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import matchingWorker from "../worker/matching-entry.js";
import { catalogRuntimeRecipes, loadRecipeBody } from "../worker/catalog-page.js";
import { runtimeEnv } from "./runtime-assets.mjs";

async function generate(ingredients, extra = {}) {
  const request = new Request("https://kutno.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ingredients, ...extra }),
  });
  const response = await matchingWorker.fetch(request, {}, { waitUntil() {} });
  const text = await response.text();
  return { response, text, data: JSON.parse(text) };
}

function topTitles(data, limit = 3) {
  return data.recipes.slice(0, limit).map((recipe) => recipe.title);
}

test("яблочные оладьи попадают в топ-3 поверх одноингредиентных яиц", async () => {
  const { data } = await generate(["яблоки", "мука", "яйца", "сахар"]);
  assert.ok(topTitles(data).some((title) => /оладьи с яблоком/i.test(title)), topTitles(data).join(", "));
});

test("яйца, молоко и мука дают оладьи в топ-3, а не три блюда из одних яиц", async () => {
  const { data } = await generate(["яйца", "молоко", "мука"]);
  assert.ok(topTitles(data).some((title) => /олад/i.test(title)), topTitles(data).join(", "));
  assert.ok(data.recipes.slice(0, 3).some((recipe) => recipe.usedCount >= 3));
});

test("сырники остаются первыми", async () => {
  const { data } = await generate(["творог", "яйца", "мука", "сахар"]);
  assert.match(data.recipes[0]?.title || "", /сырник/i);
  assert.deepEqual(data.recipes[0]?.missing || [], []);
});

test("драники остаются первыми", async () => {
  const { data } = await generate(["яйца", "картошка", "лук"]);
  assert.match(data.recipes[0]?.title || "", /драник/i);
});

test("капуста, морковь, лук и картофель: топ-3 задействует минимум три продукта", async () => {
  const { data } = await generate(["капуста", "морковь", "лук", "картофель"]);
  assert.equal(data.recipes.slice(0, 3).length, 3);
  assert.ok(data.recipes.slice(0, 3).every((recipe) => recipe.usedCount >= 3), JSON.stringify(data.recipes.slice(0, 3).map(({ title, uses }) => ({ title, uses }))));
});

const householdSets = [
  ["помидоры", "огурцы", "сметана"], ["огурцы", "помидоры", "масло"], ["рис", "молоко", "сахар"], ["тыква", "рис", "молоко"], ["морковь", "яблоко", "сахар"], ["пельмени", "сметана"], ["куриные крылья", "мёд", "соевый соус"], ["яйца", "картошка", "лук"], ["курица", "рис", "морковь"], ["макароны", "сыр", "яйца"], ["картошка", "лук", "морковь", "масло"], ["гречка", "лук", "морковь"], ["яйца", "молоко", "мука"], ["спагетти", "яйца", "сыр", "бекон"], ["хлеб", "сыр", "яйца", "масло"], ["капуста", "морковь", "лук", "картофель"], ["творог", "яйца", "мука", "сахар"], ["рис", "яйца", "лук", "морковь"], ["куриная грудка", "помидоры", "сыр"], ["фарш", "макароны", "томатная паста", "лук"], ["кабачки", "яйца", "мука", "чеснок"], ["яйца", "помидоры", "лук", "сыр", "хлеб", "масло", "молоко", "картошка"], ["картошка", "грибы", "лук"], ["макароны", "помидоры", "сыр"], ["яйца", "сыр", "помидоры"],
];

test("25 бытовых сочетаний имеют рецепт минимум с двумя продуктами пользователя", async () => {
  assert.equal(householdSets.length, 25);
  const holes = [];
  for (const ingredients of householdSets) {
    const { data } = await generate(ingredients);
    const maxUses = Math.max(0, ...data.recipes.map((recipe) => Number(recipe.usedCount) || recipe.uses?.length || 0));
    if (maxUses < 2) holes.push({ ingredients, maxUses, top: topTitles(data, 5) });
  }
  assert.deepEqual(holes, []);
});

test("семь новых бытовых рецептов входят в домашний каталог", async () => {
  const recipes = catalogRuntimeRecipes();
  const env = runtimeEnv();
  const expected = [
    "Салат из помидоров и огурцов со сметаной", "Салат из помидоров и огурцов с маслом", "Рисовая каша на молоке", "Тыквенная каша с рисом на молоке", "Морковно-яблочный салат", "Отварные пельмени со сметаной", "Куриные крылья в медово-соевом соусе",
  ];
  for (const title of expected) {
    const compact = recipes.find((item) => item.title === title);
    assert.ok(compact, title);
    assert.equal(compact.source?.type, "kutno-home-catalog");
    const full = await loadRecipeBody(new Request("https://kutno.test/"), env, compact.id, 2);
    assert.ok(full, `${title}: body`);
    assert.ok(Array.isArray(full.steps) && full.steps.length >= 3);
    assert.ok(Array.isArray(full.equipment) && full.equipment.length > 0);
    assert.ok(Number(full.minutes) > 0);
  }
});

test("SEO stale-кэш в живых обработчиках ограничен десятью минутами и purge остаётся в deploy workflow", async () => {
  const publicApp = await readFile(new URL("../worker/public-app-pages.js", import.meta.url), "utf8");
  const photos = await readFile(new URL("../worker/recipe-images.js", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../.github/workflows/check.yml", import.meta.url), "utf8");
  assert.doesNotMatch(publicApp, /stale-while-revalidate=86400/);
  assert.doesNotMatch(photos, /stale-while-revalidate=86400/);
  assert.match(publicApp, /stale-while-revalidate=600/);
  assert.match(photos, /stale-while-revalidate=600/);
  assert.match(workflow, /purge_cache/);
  assert.match(workflow, /purge_everything/);
});

test("D1 имеет версионированную миграцию TEXT id и привязку к production database id", async () => {
  const migration = await readFile(new URL("../migrations/0001_text_user_ids.sql", import.meta.url), "utf8");
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(migration, /user_id TEXT PRIMARY KEY/);
  assert.match(migration, /created_by TEXT/);
  assert.match(migration, /CAST\(created_by AS TEXT\)/);
  assert.match(wrangler, /d85a82b2-6dd0-4bb9-9539-677f049697d4/);
  assert.match(wrangler, /"migrations_dir": "migrations"/);
});
