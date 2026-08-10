import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("основная форма остаётся простой, а Worker не затирает дополнительные параметры", () => {
  const source = readFileSync("src/kitchen-simplified.inject.js", "utf8");
  const audit = readFileSync("src/audit-v7.inject.js", "utf8");
  const worker = readFileSync("worker/matching-entry.js", "utf8");
  const vite = readFileSync("vite.config.js", "utf8");

  assert.match(source, /indexOf\("<legend>Время<\/legend>"\)/);
  assert.match(source, /priorityStart/);
  assert.match(source, /\.priority-products, \.preferences-section/);
  assert.match(audit, /stripEquipmentSectionV7/);
  assert.match(audit, /state\.equipment = \[\]/);
  assert.match(worker, /maxMinutes: Math\.round\(clampNumber\(body\.maxMinutes/);
  assert.match(worker, /portions: Math\.round\(clampNumber\(body\.portions/);
  assert.match(worker, /priorityIngredients: Array\.isArray\(body\.priorityIngredients\)/);
  assert.match(worker, /const difficulty = typeof body\.difficulty/);
  assert.match(vite, /kitchen-simplified\.inject\.js/);
  assert.match(vite, /audit-v7\.inject\.js/);
});

test("результаты содержат сортировки и постепенное раскрытие", () => {
  const source = readFileSync("src/kitchen-simplified.inject.js", "utf8");
  const styles = readFileSync("public/kitchen-results-sorting.css", "utf8");

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
  assert.match(source, /const nextText = `Осталось \$\{remaining\}`/);
  assert.match(source, /remainder\.textContent !== nextText/);
  assert.match(styles, /\.recipe-entry\[hidden\]/);
  assert.match(styles, /display: none !important/);
  assert.match(source, /function mountKitchenSortV5/);
  assert.match(source, /function flattenSortedKitchenResultsV5/);
  assert.match(source, /recipeOrder = new Map/);
  assert.match(source, /recipeList\.replaceChildren\(fragment\)/);
  assert.match(source, /new MutationObserver\(scheduleKitchenSortMountV5\)/);
});

test("Worker не обрезает выдачу до трёх и использует честную пагинацию", () => {
  const client = readFileSync("src/main.js", "utf8");
  const worker = readFileSync("worker/matching-entry.js", "utf8");

  assert.match(client, /hasMoreRecipes = Boolean\(data\.hasMore\)/);
  assert.match(worker, /MATCHING_PAGE_SIZE = 20/);
  assert.match(worker, /total: recipes\.length/);
  assert.match(worker, /offset \+ page\.length < recipes\.length/);
  assert.match(worker, /loadRuntimeRecipes/);
  assert.match(worker, /matchingCatalog/);
  assert.doesNotMatch(worker, /catalogSources/);
  assert.doesNotMatch(worker, /recipes\.slice\(0, 3\)/);
  assert.match(worker, /body\.maxMinutes > 0/);
  assert.match(worker, /difficultyRank/);
});

test("финальная выдача всегда делится на три понятные группы", () => {
  const audit = readFileSync("src/audit-v7.inject.js", "utf8");
  for (const title of ["Готовьте сейчас", "Купить один продукт", "Почти подходит"]) assert.match(audit, new RegExp(title));
  assert.match(audit, /analysis\.requiredMissing\.length === 1/);
  assert.match(audit, /analysis\.requiredMissing\.length >= 2/);
});
