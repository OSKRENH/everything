const KITCHEN_INITIAL_RESULTS_V5 = 5;
const KITCHEN_RESULTS_INCREMENT_V5 = 5;
let kitchenResultSortModeV5 = "";
let kitchenSortMountQueuedV5 = false;
let kitchenVisibleResultsV5 = KITCHEN_INITIAL_RESULTS_V5;

function normalizeKitchenPlanningStateV5() {
  state.maxMinutes = 0;
  state.portions = 2;
  state.priorityIngredients = [];
}

function stripKitchenPlanningControlsV5(markup) {
  let output = String(markup);

  const priorityStart = output.indexOf('<div class="priority-products');
  const quickRowStart = output.indexOf('<div class="quick-row', Math.max(0, priorityStart));
  if (priorityStart >= 0 && quickRowStart > priorityStart) {
    output = `${output.slice(0, priorityStart)}${output.slice(quickRowStart)}`;
  }

  const timeLegend = output.indexOf("<legend>Время</legend>");
  const courseLegend = output.indexOf("<legend>Что приготовить</legend>", Math.max(0, timeLegend));
  if (timeLegend >= 0 && courseLegend > timeLegend) {
    const timeFieldset = output.lastIndexOf("<fieldset>", timeLegend);
    const courseFieldset = output.lastIndexOf("<fieldset>", courseLegend);
    if (timeFieldset >= 0 && courseFieldset > timeFieldset) {
      output = `${output.slice(0, timeFieldset)}${output.slice(courseFieldset)}`;
    }
  }

  const preferencesStart = output.indexOf('<section class="form-section preferences-section">');
  const actionStart = output.indexOf('<button class="primary-action"', Math.max(0, preferencesStart));
  if (preferencesStart >= 0 && actionStart > preferencesStart) {
    output = `${output.slice(0, preferencesStart)}${output.slice(actionStart)}`;
  }

  return output;
}

function pruneKitchenPlanningControlsDomV5(root = app) {
  root?.querySelectorAll?.(".priority-products, .preferences-section").forEach((section) => section.remove());
  root?.querySelectorAll?.("fieldset > legend").forEach((legend) => {
    if (legend.textContent?.trim() === "Время") legend.closest("fieldset")?.remove();
  });
}

function kitchenDifficultyRankV5(value = "") {
  const text = String(value).toLocaleLowerCase("ru-RU");
  if (/очень\s*прост/.test(text)) return 0;
  if (/легк|прост/.test(text)) return 1;
  if (/обыч|сред/.test(text)) return 2;
  if (/слож|труд/.test(text)) return 3;
  return 2;
}

function sortedKitchenRecipesV5(list = recipes) {
  const copy = [...list];
  if (kitchenResultSortModeV5 === "fastest") {
    return copy.sort((first, second) => Number(first?.minutes || 9999) - Number(second?.minutes || 9999)
      || kitchenDifficultyRankV5(first?.difficulty) - kitchenDifficultyRankV5(second?.difficulty));
  }
  if (kitchenResultSortModeV5 === "easiest") {
    return copy.sort((first, second) => kitchenDifficultyRankV5(first?.difficulty) - kitchenDifficultyRankV5(second?.difficulty)
      || Number(first?.minutes || 9999) - Number(second?.minutes || 9999));
  }
  return copy;
}

function kitchenSortLabelV5() {
  if (kitchenResultSortModeV5 === "fastest") return "Приготовить быстрее";
  if (kitchenResultSortModeV5 === "easiest") return "Сначала простые рецепты";
  return "Сортировка";
}

function renderKitchenSortV5() {
  return `<div class="kitchen-results-sort">
    <details>
      <summary>${escapeHtml(kitchenSortLabelV5())}<span aria-hidden="true">↓</span></summary>
      <div class="kitchen-results-sort-menu" role="group" aria-label="Сортировка рецептов">
        <button type="button" class="${kitchenResultSortModeV5 === "fastest" ? "active" : ""}" data-kitchen-results-sort="fastest">Приготовить быстрее</button>
        <button type="button" class="${kitchenResultSortModeV5 === "easiest" ? "active" : ""}" data-kitchen-results-sort="easiest">Сначала простые рецепты</button>
      </div>
    </details>
  </div>`;
}

function renderKitchenRevealMoreV5(remaining) {
  return `<button type="button" class="load-more-recipes kitchen-reveal-more" data-kitchen-reveal-more>
    <span>Загрузить ещё варианты</span>
    <small>Осталось ${remaining}</small>
    <span aria-hidden="true">↓</span>
  </button>`;
}

function kitchenRecipeEntryTitleV5(entry) {
  return entry.querySelector(".recipe-title-button")?.textContent?.trim() || "";
}

function flattenSortedKitchenResultsV5(recipeList) {
  if (!kitchenResultSortModeV5) return;
  const entries = [...recipeList.querySelectorAll(".recipe-entry")];
  if (!entries.length) return;

  const recipeOrder = new Map(recipes.map((recipe, index) => [normalize(recipe.title), index]));
  const sortedEntries = [...entries].sort((first, second) => {
    const firstOrder = recipeOrder.get(normalize(kitchenRecipeEntryTitleV5(first))) ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = recipeOrder.get(normalize(kitchenRecipeEntryTitleV5(second))) ?? Number.MAX_SAFE_INTEGER;
    return firstOrder - secondOrder;
  });
  const directEntries = [...recipeList.children].filter((node) => node.classList?.contains("recipe-entry"));
  const orderIsCorrect = directEntries.length === sortedEntries.length
    && directEntries.every((entry, index) => entry === sortedEntries[index]);
  const containsOnlySortedContent = [...recipeList.children].every((node) => node.classList?.contains("kitchen-results-sort")
    || node.classList?.contains("recipe-entry")
    || node.hasAttribute?.("data-kitchen-reveal-more"));
  if (orderIsCorrect && containsOnlySortedContent) return;

  const sortControl = recipeList.querySelector(".kitchen-results-sort");
  const revealControl = recipeList.querySelector("[data-kitchen-reveal-more]");
  const fragment = document.createDocumentFragment();
  if (sortControl) fragment.append(sortControl);
  sortedEntries.forEach((entry) => fragment.append(entry));
  if (revealControl) fragment.append(revealControl);
  recipeList.replaceChildren(fragment);
}

function applyKitchenResultVisibilityV5(recipeList) {
  const entries = [...recipeList.querySelectorAll(".recipe-entry")];
  entries.forEach((entry, index) => {
    entry.hidden = index >= kitchenVisibleResultsV5;
  });

  recipeList.querySelectorAll(".matching-group").forEach((group) => {
    group.hidden = !group.querySelector(".recipe-entry:not([hidden])");
  });

  const remaining = Math.max(0, entries.length - kitchenVisibleResultsV5);
  const existingButton = recipeList.querySelector("[data-kitchen-reveal-more]");
  if (!remaining) {
    existingButton?.remove();
    return;
  }
  if (!existingButton) {
    recipeList.insertAdjacentHTML("beforeend", renderKitchenRevealMoreV5(remaining));
    return;
  }
  const remainder = existingButton.querySelector("small");
  if (remainder) remainder.textContent = `Осталось ${remaining}`;
}

function mountKitchenSortV5() {
  kitchenSortMountQueuedV5 = false;
  const recipeList = app?.querySelector?.(".recipe-list");
  if (!recipeList || !recipes.length || isLoading) return;
  if (!recipeList.querySelector(".kitchen-results-sort")) {
    recipeList.insertAdjacentHTML("afterbegin", renderKitchenSortV5());
  }
  flattenSortedKitchenResultsV5(recipeList);
  applyKitchenResultVisibilityV5(recipeList);
}

function scheduleKitchenSortMountV5() {
  if (kitchenSortMountQueuedV5) return;
  kitchenSortMountQueuedV5 = true;
  queueMicrotask(mountKitchenSortV5);
}

const kitchenViewBeforeSimplifiedV5 = renderKitchenView;
renderKitchenView = function simplifiedKitchenViewV5() {
  normalizeKitchenPlanningStateV5();
  return stripKitchenPlanningControlsV5(kitchenViewBeforeSimplifiedV5());
};

const resultsBeforeSimplifiedV5 = renderResults;
renderResults = function simplifiedKitchenResultsV5() {
  if (recipes.length) recipes = sortedKitchenRecipesV5(recipes);
  return resultsBeforeSimplifiedV5()
    .replace("Варианты расположены от самого подходящего. Базовые специи и масло не считаются.", "Показаны все подходящие варианты. Базовые специи и масло не считаются.")
    .replace("Сбросить время и тип блюда", "Показать все типы блюд");
};

generateRecipes = async function generateAllKitchenRecipesV5({ append = false } = {}) {
  normalizeKitchenPlanningStateV5();
  if (!state.ingredients.length || isLoading || isLoadingMore) return;
  const userContext = matchingUserContextV4();

  isLoading = true;
  isLoadingMore = false;
  recipes = [];
  hasMoreRecipes = false;
  generationError = "";
  loadMoreMessage = "";
  matchingRelaxation = null;
  matchingExpansionSuggestionV4 = null;
  kitchenResultSortModeV5 = "";
  kitchenVisibleResultsV5 = KITCHEN_INITIAL_RESULTS_V5;
  renderKitchenResults();

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ingredients: state.ingredients,
        equipment: state.equipment.map(equipmentName),
        portions: 2,
        searchMode: state.searchMode,
        course: state.course,
        baseIngredients: matchingBaseIngredients(),
        pantry: userContext.pantry,
        feedback: userContext.feedback,
        excludeTitles: [],
        excludeSourceIds: [],
        variation: Date.now() % 1000000,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось составить меню");
    if (!Array.isArray(data.recipes)) throw new Error("Подбор вернул некорректный ответ");

    matchingExpansionSuggestionV4 = data.suggestedExpansion || null;
    const incomingLimit = Math.max(3, data.recipes.length);
    recipes = mergeUniqueRecipes([], data.recipes, [], incomingLimit);
    hasMoreRecipes = false;
    if (!recipes.length) generationError = data.error || matchingExpansionSuggestionV4?.title || "Для этого набора пока нет точного рецепта";
    recentRecipeTitles = recipes.map((recipe) => recipe.title).filter(Boolean).slice(-30);
    recentSourceIds = recipes.map((recipe) => String(recipe.source?.id || "")).filter(Boolean).slice(-30);
    kutnoApi.telemetry("kitchen_matching_completed", {
      recipes: recipes.length,
      strict: state.searchMode !== "plus-one",
      pantryItems: Object.keys(userContext.pantry).length,
      feedbackItems: userContext.feedback.length,
      sortMode: kitchenResultSortModeV5 || "relevance",
      allResults: true,
    }, "debug");
  } catch (error) {
    recipes = fallbackRecipesForRequestV4();
    hasMoreRecipes = false;
    matchingExpansionSuggestionV4 = null;
    if (recipes.length) loadMoreMessage = "Сервер не ответил — показаны резервные проверенные рецепты";
    else generationError = error instanceof Error ? error.message : "Попробуйте ещё раз";
    kutnoApi.telemetry("kitchen_matching_fallback", {
      message: error instanceof Error ? error.message : String(error || ""),
      recipes: recipes.length,
    }, "warn");
  } finally {
    isLoading = false;
    isLoadingMore = false;
    renderKitchenResults();
    mountKitchenSortV5();
    requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
};

app.addEventListener("click", (event) => {
  const revealButton = event.target.closest("[data-kitchen-reveal-more]");
  if (revealButton) {
    event.preventDefault();
    kitchenVisibleResultsV5 += KITCHEN_RESULTS_INCREMENT_V5;
    applyKitchenResultVisibilityV5(revealButton.closest(".recipe-list"));
    return;
  }

  const sortButton = event.target.closest("[data-kitchen-results-sort]");
  if (!sortButton) return;
  event.preventDefault();
  kitchenResultSortModeV5 = sortButton.dataset.kitchenResultsSort;
  recipes = sortedKitchenRecipesV5(recipes);
  sortButton.closest("details")?.removeAttribute("open");
  renderKitchenResults();
  mountKitchenSortV5();
});

normalizeKitchenPlanningStateV5();
pruneKitchenPlanningControlsDomV5();
new MutationObserver(scheduleKitchenSortMountV5).observe(app, { childList: true, subtree: true });
scheduleKitchenSortMountV5();

if (!document.querySelector('link[href="/kitchen-results-sorting.css?v=2"]')) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/kitchen-results-sorting.css?v=2";
  document.head.append(stylesheet);
}
