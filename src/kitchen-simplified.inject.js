let kitchenResultSortModeV5 = "";

function normalizeKitchenPlanningStateV5() {
  state.maxMinutes = 0;
  state.portions = 2;
}

function stripKitchenPlanningControlsV5(markup) {
  return String(markup)
    .replace(/<fieldset>\s*<legend>Время<\/legend>[\s\S]*?<\/fieldset>/u, "")
    .replace(/\s*<section class="form-section preferences-section">[\s\S]*?<\/section>\s*(?=<button class="primary-action")/u, "\n\n        ");
}

function kitchenDifficultyRankV5(value = "") {
  const text = String(value).toLocaleLowerCase("ru-RU");
  if (/очень\s*прост|легк/.test(text)) return 0;
  if (/прост/.test(text)) return 1;
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

const kitchenViewBeforeSimplifiedV5 = renderKitchenView;
renderKitchenView = function simplifiedKitchenViewV5() {
  normalizeKitchenPlanningStateV5();
  return stripKitchenPlanningControlsV5(kitchenViewBeforeSimplifiedV5());
};

const resultsBeforeSimplifiedV5 = renderResults;
renderResults = function simplifiedKitchenResultsV5() {
  if (recipes.length) recipes = sortedKitchenRecipesV5(recipes);
  const markup = resultsBeforeSimplifiedV5();
  if (!recipes.length || isLoading || !markup.includes('<div class="recipe-list">')) return markup;
  return markup
    .replace("Варианты расположены от самого подходящего. Базовые специи и масло не считаются.", "Показаны все подходящие варианты. Базовые специи и масло не считаются.")
    .replace('<div class="recipe-list">', `<div class="recipe-list">${renderKitchenSortV5()}`);
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
        priorityIngredients: state.priorityIngredients,
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
    requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
};

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-kitchen-results-sort]");
  if (!button) return;
  event.preventDefault();
  kitchenResultSortModeV5 = button.dataset.kitchenResultsSort;
  recipes = sortedKitchenRecipesV5(recipes);
  button.closest("details")?.removeAttribute("open");
  renderKitchenResults();
});

if (!document.querySelector('link[href="/kitchen-results-sorting.css?v=1"]')) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/kitchen-results-sorting.css?v=1";
  document.head.append(stylesheet);
}
