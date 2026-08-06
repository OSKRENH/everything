import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("форма кухни удаляет время, сложность, порции и приоритет продуктов", () => {
  const source = readFileSync("src/kitchen-simplified.inject.js", "utf8");
  const vite = readFileSync("vite.config.js", "utf8");

  assert.match(source, /indexOf\("<legend>Время<\/legend>"\)/);
  assert.match(source, /indexOf\("<legend>Что приготовить<\/legend>"/);
  assert.match(source, /priorityStart/);
  assert.match(source, /quickRowStart/);
  assert.match(source, /\.priority-products, \.preferences-section/);
  assert.match(source, /state\.priorityIngredients = \[\]/);
  assert.match(source, /state\.maxMinutes = 0/);
  assert.match(source, /state\.portions = 2/);
  assert.doesNotMatch(source, /priorityIngredients: state\.priorityIngredients/);
  assert.match(vite, /kitchen-simplified\.inject\.js/);
  assert.match(vite, /Техника и избранное останутся без изменений/);
});

test("результаты содержат сортировки и постепенное раскрытие", () => {
  const source = readFileSync("src/kitchen-simplified.inject.js", "utf8");

  assert.match(source, /Приготовить быстрее/);
  assert.match(source, /Сначала простые рецепты/);
  assert.match(source, /Number\(first\?\.minutes/);
  assert.match(source, /kitchenDifficultyRankV5/);
  assert.match(source, /data-kitchen-results-sort/);
  assert.match(source, /KITCHEN_INITIAL_RESULTS_V5 = 5/);
  assert.match(source, /KITCHEN_RESULTS_INCREMENT_V5 = 5/);
  assert.match(source, /Загрузить ещё варианты/);
  assert.match(source, /data-kitchen-reveal-more/);
  assert.match(source, /applyKitchenResultVisibilityV5/);
  assert.match(source, /entry\.hidden = index >= kitchenVisibleResultsV5/);
  assert.match(source, /function mountKitchenSortV5/);
  assert.match(source, /function flattenSortedKitchenResultsV5/);
  assert.match(source, /recipeOrder = new Map/);
  assert.match(source, /recipeList\.replaceChildren\(fragment\)/);
  assert.match(source, /new MutationObserver\(scheduleKitchenSortMountV5\)/);
});

test("Worker и клиент не обрезают подходящие рецепты до трёх", () => {
  const client = readFileSync("src/kitchen-simplified.inject.js", "utf8");
  const worker = readFileSync("worker/matching-entry.js", "utf8");

  assert.match(client, /Math\.max\(3, data\.recipes\.length\)/);
  assert.match(client, /hasMoreRecipes = false/);
  assert.match(worker, /recipes,\n    hasMore: false/);
  assert.match(worker, /simpleRecipesForPortions/);
  assert.doesNotMatch(worker, /recipes\.slice\(0, 3\)/);
  assert.doesNotMatch(worker, /Number\(body\.maxMinutes\).*recipe\.minutes/);
  assert.doesNotMatch(worker, /difficultyRank/);
});
