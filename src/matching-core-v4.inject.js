let matchingExpansionSuggestionV4 = null;

function knownMatchingRecipesV4() {
  const seen = new Set();
  return [...recipes, ...catalogRecipes, ...favoriteRecipes].filter((recipe) => {
    if (!recipe?.title) return false;
    const id = recipeId(recipe);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function matchingUserContextV4() {
  const context = matchingBrowserUserContext();
  const known = knownMatchingRecipesV4();
  const feedback = context.feedback.map((item) => {
    const recipe = known.find((candidate) => (item.recipeId && recipeId(candidate) === item.recipeId)
      || (item.title && normalize(candidate.title) === normalize(item.title)));
    if (!recipe) return item;
    return {
      ...item,
      cuisine: item.cuisine || recipe.cuisine || "",
      course: item.course || recipe.course || "",
      protein: item.protein || recipe.protein || "",
      ingredients: item.ingredients?.length ? item.ingredients : (recipe.ingredients || []).map((ingredient) => ingredient.name).filter(Boolean),
    };
  });
  return { pantry: context.pantry, feedback };
}

matchingAnalysis = function trustworthyMatchingAnalysis(recipe) {
  const base = semanticAnalyzeRecipe(recipe, matchingContext());
  const analysis = matchingApplyUserContext(recipe, base, matchingUserContextV4());
  if (recipe?.source?.type === "generated") analysis.score -= 30;
  return analysis;
};

function allowedFallbackRecipeV4(recipe) {
  const group = matchingAnalysis(recipe).group;
  return state.searchMode === "plus-one"
    ? ["ready", "substitute", "one"].includes(group)
    : ["ready", "substitute"].includes(group);
}

function fallbackRecipesForRequestV4() {
  try {
    return orderCatalogRecipes(getFallbackSuggestions().filter(allowedFallbackRecipeV4)).slice(0, 3);
  } catch {
    return getFallbackSuggestions().filter(allowedFallbackRecipeV4).slice(0, 3);
  }
}

generateRecipes = async function trustworthyGenerateRecipes({ append = false } = {}) {
  if (!state.ingredients.length || isLoading || isLoadingMore) return;
  const existingRecipes = append ? [...recipes] : [];
  const excludeTitles = [...new Set([...recentRecipeTitles, ...recipes.map((recipe) => recipe.title).filter(Boolean)])].slice(-24);
  const excludeSourceIds = [...new Set([...recentSourceIds, ...recipes.map((recipe) => String(recipe.source?.id || "")).filter(Boolean)])].slice(-30);
  const userContext = matchingUserContextV4();

  if (append) isLoadingMore = true;
  else {
    recipes = [];
    isLoading = true;
    matchingExpansionSuggestionV4 = null;
  }
  generationError = "";
  loadMoreMessage = "";
  matchingRelaxation = null;
  renderKitchenResults();

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ingredients: state.ingredients,
        equipment: state.equipment.map(equipmentName),
        difficulty: state.difficulty,
        portions: state.portions,
        searchMode: state.searchMode,
        maxMinutes: state.maxMinutes,
        course: state.course,
        priorityIngredients: state.priorityIngredients,
        baseIngredients: matchingBaseIngredients(),
        pantry: userContext.pantry,
        feedback: userContext.feedback,
        excludeTitles,
        excludeSourceIds,
        variation: Date.now() % 1000000,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось составить меню");
    if (!Array.isArray(data.recipes)) throw new Error("Подбор вернул некорректный ответ");

    matchingExpansionSuggestionV4 = data.suggestedExpansion || null;
    matchingRelaxation = null;
    const incoming = mergeUniqueRecipes([], data.recipes, excludeTitles, 3);
    if (append) {
      recipes = mergeUniqueRecipes(existingRecipes, incoming, [], existingRecipes.length + 3);
      if (recipes.length === existingRecipes.length) loadMoreMessage = "Для этого набора больше надёжных вариантов нет";
    } else {
      recipes = incoming;
    }
    hasMoreRecipes = Boolean(data.hasMore) && recipes.length > 0;
    if (!recipes.length) generationError = data.error || matchingExpansionSuggestionV4?.title || "Для этого набора пока нет точного рецепта";
    recentRecipeTitles = [...new Set([...excludeTitles, ...recipes.map((recipe) => recipe.title).filter(Boolean)])].slice(-30);
    recentSourceIds = [...new Set([...excludeSourceIds, ...recipes.map((recipe) => String(recipe.source?.id || "")).filter(Boolean)])].slice(-30);
    kutnoApi.telemetry("kitchen_matching_completed", {
      recipes: recipes.length,
      strict: state.searchMode !== "plus-one",
      pantryItems: Object.keys(userContext.pantry).length,
      feedbackItems: userContext.feedback.length,
      suggestedExpansion: matchingExpansionSuggestionV4?.code || "",
    }, "debug");
  } catch (error) {
    const safeFallbacks = fallbackRecipesForRequestV4();
    if (append) {
      recipes = mergeUniqueRecipes(existingRecipes, safeFallbacks, excludeTitles, existingRecipes.length + 3);
      loadMoreMessage = recipes.length > existingRecipes.length ? "Показаны резервные проверенные варианты" : "Для этого набора больше надёжных вариантов нет";
    } else {
      recipes = safeFallbacks;
      if (recipes.length) loadMoreMessage = "Сервер не ответил — показаны резервные проверенные рецепты";
      else generationError = error instanceof Error ? error.message : "Попробуйте ещё раз";
    }
    hasMoreRecipes = false;
    matchingExpansionSuggestionV4 = null;
    kutnoApi.telemetry("kitchen_matching_fallback", {
      message: error instanceof Error ? error.message : String(error || ""),
      recipes: recipes.length,
    }, "warn");
  } finally {
    isLoading = false;
    isLoadingMore = false;
    renderKitchenResults();
    if (!append) requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
};

const renderResultsBeforeTrustworthyMatchingV4 = renderResults;
renderResults = function trustworthyMatchingResults() {
  const original = renderResultsBeforeTrustworthyMatchingV4();
  if (isLoading || !matchingExpansionSuggestionV4) return original;
  const suggestion = matchingExpansionSuggestionV4;
  const buttonText = suggestion.code === "allow-one-purchase"
    ? `Показать с одной покупкой${suggestion.count ? ` · ${suggestion.count}` : ""}`
    : `Сбросить время и тип блюда${suggestion.count ? ` · ${suggestion.count}` : ""}`;
  const offer = `<section class="generation-error matching-expansion-offer" id="results" aria-live="polite">
    <span>${escapeHtml(suggestion.title || "Можно расширить поиск")}</span>
    <p>${escapeHtml(suggestion.details || "Продукты и техника останутся без изменений.")}</p>
    <button type="button" data-matching-expand="${escapeHtml(suggestion.code || "")}">${escapeHtml(buttonText)}</button>
  </section>`;
  return recipes.length ? `${original}${offer}` : offer;
};

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-matching-expand]");
  if (!button) return;
  event.preventDefault();
  const code = button.dataset.matchingExpand;
  if (code === "allow-one-purchase") state.searchMode = "plus-one";
  if (code === "relax-filters") {
    state.maxMinutes = 0;
    state.course = "все";
  }
  matchingExpansionSuggestionV4 = null;
  generationError = "";
  saveState();
  renderMainView();
  generateRecipes();
});

function feedbackRecipeV4() {
  if (activeRecipe) return activeRecipe;
  if (currentView === "swipe") return swipeRecipes[swipeIndex] || null;
  return null;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-feedback-reason]");
  if (!button) return;
  const recipe = feedbackRecipeV4();
  const reason = button.dataset.feedbackReason;
  window.setTimeout(() => {
    if (!recipe) return;
    try {
      const items = JSON.parse(localStorage.getItem("kutno-recipe-feedback-v1") || "[]");
      const target = items.find((item) => item.reason === reason
        && (!item.title || normalize(item.title) === normalize(recipe.title))
        && Date.now() - Number(item.at || item.updatedAt || 0) < 5000);
      if (!target) return;
      target.cuisine = recipe.cuisine || "";
      target.course = recipe.course || "";
      target.protein = recipe.protein || "";
      target.ingredients = (recipe.ingredients || []).map((ingredient) => ingredient.name).filter(Boolean).slice(0, 20);
      localStorage.setItem("kutno-recipe-feedback-v1", JSON.stringify(items));
    } catch {
      // Основная обратная связь уже сохранена модулем функций рецепта.
    }
  }, 0);
});
