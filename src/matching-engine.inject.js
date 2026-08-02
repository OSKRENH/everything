const MATCHING_BASE_KEY = "kutno-base-ingredients-v1";
let matchingRelaxation = null;
let matchingMutationQueued = false;

function matchingBaseIngredients() {
  try {
    const stored = JSON.parse(localStorage.getItem(MATCHING_BASE_KEY));
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {
    // Используем безопасный набор по умолчанию.
  }
  return [...SEMANTIC_DEFAULT_BASE_INGREDIENTS];
}

function matchingContext() {
  return {
    ingredients: state.ingredients,
    priorityIngredients: state.priorityIngredients,
    equipment: state.equipment,
    baseIngredients: matchingBaseIngredients(),
  };
}

function matchingAnalysis(recipe) {
  const analysis = semanticAnalyzeRecipe(recipe, matchingContext());
  if (recipe?.source?.type === "generated") analysis.score -= 30;
  return analysis;
}

function matchingGroupMeta(group) {
  return {
    ready: { title: "Можно приготовить сейчас", note: "Все обязательные продукты и техника есть" },
    substitute: { title: "Можно с заменой", note: "Основное есть, необязательное можно пропустить или заменить" },
    one: { title: "Не хватает одного продукта", note: "Ближайшие варианты с одной покупкой" },
    more: { title: "Нужно докупить", note: "Показаны ниже, чтобы не мешать готовым вариантам" },
  }[group] || { title: "Другие варианты", note: "" };
}

function matchingGroupRecipes(items) {
  const groups = { ready: [], substitute: [], one: [], more: [] };
  [...items].sort((first, second) => matchingAnalysis(second).score - matchingAnalysis(first).score || Number(first.minutes) - Number(second.minutes))
    .forEach((recipe) => groups[matchingAnalysis(recipe).group].push(recipe));
  return groups;
}

function matchingSummary(items) {
  const groups = matchingGroupRecipes(items);
  return `<div class="matching-summary" aria-label="Результаты подбора">
    <span><b>${groups.ready.length}</b> сейчас</span>
    <span><b>${groups.substitute.length}</b> с заменой</span>
    <span><b>${groups.one.length}</b> докупить один</span>
    ${groups.more.length ? `<span><b>${groups.more.length}</b> докупить несколько</span>` : ""}
  </div>`;
}

function matchingReasonsMarkup(analysis) {
  if (!analysis.reasons.length) return "";
  return `<ul class="matching-reasons">${analysis.reasons.slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`;
}

function matchingStatus(analysis) {
  if (analysis.group === "ready") return { className: "complete", text: "Можно приготовить сейчас" };
  if (analysis.group === "substitute") return { className: "with-substitution", text: analysis.substitutions.length ? "Можно с заменой" : "Необязательное можно пропустить" };
  if (analysis.group === "one") return { className: "needs-one", text: `Докупить: ${analysis.requiredMissing[0]?.name || "1 продукт"}` };
  return { className: "needs-many", text: `Не хватает продуктов: ${analysis.requiredMissing.length}` };
}

const matchingOriginalFetch = window.fetch.bind(window);
window.fetch = async function matchingFetch(input, init = {}) {
  let nextInput = input;
  let nextInit = init;
  const requestUrl = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
  const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

  if (requestUrl.pathname === "/api/generate" && method === "POST" && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      body.baseIngredients = matchingBaseIngredients();
      nextInit = { ...init, body: JSON.stringify(body) };
    } catch {
      // Исходный запрос остаётся без изменений.
    }
  }

  if (requestUrl.pathname === "/api/catalog" && method === "GET") {
    state.ingredients.forEach((item) => requestUrl.searchParams.append("ingredient", item));
    state.priorityIngredients.forEach((item) => requestUrl.searchParams.append("priority", item));
    state.equipment.forEach((item) => requestUrl.searchParams.append("equipment", item));
    nextInput = requestUrl.toString();
  }

  const response = await matchingOriginalFetch(nextInput, nextInit);
  if (requestUrl.pathname === "/api/generate" && method === "POST") {
    response.clone().json().then((data) => {
      matchingRelaxation = data?.relaxation || null;
    }).catch(() => {});
  }
  return response;
};

ingredientMatches = function semanticIngredientMatches(first = "", second = "") {
  return semanticIngredientMatch(first, second).type !== "none";
};

catalogMissingIngredients = function semanticCatalogMissingIngredients(recipe) {
  return matchingAnalysis(recipe).requiredMissing.map((item) => item.name);
};

orderCatalogRecipes = function semanticOrderCatalogRecipes(recipesToOrder) {
  return [...recipesToOrder].sort((first, second) => matchingAnalysis(second).score - matchingAnalysis(first).score
    || Number(first.course === "соус") - Number(second.course === "соус")
    || Number(first.minutes) - Number(second.minutes));
};

filteredCatalogRecipes = function semanticFilteredCatalogRecipes() {
  const query = normalize(catalogQuery);
  return catalogRecipes.filter((recipe) => {
    const analysis = matchingAnalysis(recipe);
    const cuisineMatches = catalogCuisine === "все" || recipe.cuisine === catalogCuisine;
    const difficultyMatches = catalogDifficulty === "все" || difficultyValue(recipe.difficulty) === catalogDifficulty;
    const courseMatches = catalogCourse === "все" || recipe.course === catalogCourse;
    const proteinMatches = catalogProtein === "все" || recipe.protein === catalogProtein;
    const availabilityMatches = catalogAvailability === "все"
      || (catalogAvailability === "ready" && ["ready", "substitute"].includes(analysis.group))
      || (catalogAvailability === "one" && analysis.group === "one");
    const timeMatches = !catalogMaxMinutes || Number(recipe.minutes) <= catalogMaxMinutes;
    const searchable = [recipe.title, recipe.subtitle, recipe.cuisine, ...(recipe.ingredients || []).map((item) => item.name)].join(" ");
    return cuisineMatches && difficultyMatches && courseMatches && proteinMatches && availabilityMatches && timeMatches && (!query || normalize(searchable).includes(query));
  });
};

renderRecipeCard = function semanticRenderRecipeCard(recipe, index, source = "recipes") {
  const analysis = matchingAnalysis(recipe);
  const status = matchingStatus(analysis);
  const favorite = isFavorite(recipe);
  const calories = Number(recipe.nutrition?.calories) || 0;
  const subtitle = String(recipe.subtitle || recipe.why || "").trim();
  const generatedByAi = recipe.source?.type === "generated";
  return `<article class="recipe-entry matching-${analysis.group}">
    <div class="recipe-number">${String(index + 1).padStart(2, "0")}</div>
    <div class="recipe-main">
      <div class="recipe-card-topline">
        <div class="recipe-badges"><div class="recipe-status ${status.className}">${escapeHtml(status.text)}</div>${generatedByAi ? `<span class="recipe-ai-label">Сгенерировано ИИ</span>` : ""}</div>
        <button class="favorite-toggle ${favorite ? "active" : ""}" data-toggle-favorite-source="${source}" data-recipe-index="${index}" aria-pressed="${favorite}" aria-label="${favorite ? "Убрать из избранного" : "Сохранить в избранное"}">${favorite ? "♥" : "♡"}</button>
      </div>
      <h3><button class="recipe-title-button" data-open-recipe="${index}" data-recipe-source="${source}">${escapeHtml(recipe.title)}</button></h3>
      ${subtitle ? `<p class="recipe-subtitle">${escapeHtml(subtitle)}</p>` : ""}
      ${matchingReasonsMarkup(analysis)}
      <div class="recipe-meta"><span>${Number(recipe.minutes) || 30} мин</span><span>${escapeHtml(recipe.difficulty || "просто")}</span>${calories ? `<span>≈ ${calories} ккал</span>` : ""}<span>${analysis.group === "ready" ? "Без покупок" : analysis.group === "substitute" ? "С заменой" : `${analysis.requiredMissing.length} покупка`}</span></div>
    </div>
    <div class="recipe-side">
      ${analysis.exactAvailable.length ? `<p class="uses-line">Используем: ${analysis.exactAvailable.filter((item) => item.role !== "base").slice(0, 5).map((item) => escapeHtml(item.name)).join(", ")}</p>` : ""}
      <button class="open-recipe" data-open-recipe="${index}" data-recipe-source="${source}">Открыть рецепт <span aria-hidden="true">→</span></button>
    </div>
  </article>`;
};

renderCatalogCard = function semanticRenderCatalogCard(recipe, index) {
  const analysis = matchingAnalysis(recipe);
  const status = matchingStatus(analysis);
  const favorite = isFavorite(recipe);
  const ingredients = (recipe.ingredients || []).slice(0, 5).map((item) => escapeHtml(item.name));
  return `<article class="catalog-card matching-${analysis.group}">
    <div class="catalog-card-index">${String(index + 1).padStart(2, "0")}</div>
    <div class="catalog-card-topline"><span>${escapeHtml(`${recipe.flag || "🌍"} ${recipe.cuisine || "Мировая кухня"}`)}</span><button class="favorite-toggle ${favorite ? "active" : ""}" data-toggle-favorite-source="catalog" data-recipe-index="${index}" aria-label="${favorite ? "Убрать из избранного" : "Сохранить в избранное"}">${favorite ? "♥" : "♡"}</button></div>
    ${state.ingredients.length ? `<div class="catalog-availability ${status.className}">${escapeHtml(status.text)}</div>` : ""}
    <h3><button data-open-recipe="${index}" data-recipe-source="catalog">${escapeHtml(recipe.title)}</button></h3>
    <p>${escapeHtml(recipe.subtitle || "Классический рецепт")}</p>
    ${state.ingredients.length ? matchingReasonsMarkup(analysis) : ""}
    <div class="catalog-card-meta"><span>${escapeHtml(recipe.course || "основное")}</span><span>${escapeHtml(recipe.protein || "без мяса")}</span><span>${Number(recipe.minutes) || 30} мин</span><span>${escapeHtml(recipe.difficulty || "легко")}</span><span>≈ ${Number(recipe.nutrition?.calories) || 0} ккал</span></div>
    <p class="catalog-ingredients">${ingredients.join(" · ")}${(recipe.ingredients || []).length > 5 ? " · …" : ""}</p>
    <button class="catalog-open" data-open-recipe="${index}" data-recipe-source="catalog">Открыть рецепт <span>→</span></button>
  </article>`;
};

function renderMatchingGroups(items, cardRenderer, source = "catalog") {
  const groups = matchingGroupRecipes(items);
  return ["ready", "substitute", "one", "more"].map((group) => {
    const recipesInGroup = groups[group];
    if (!recipesInGroup.length) return "";
    const meta = matchingGroupMeta(group);
    return `<section class="matching-group matching-group-${group}"><header><div><span>${String(recipesInGroup.length).padStart(2, "0")}</span><h3>${meta.title}</h3></div><p>${meta.note}</p></header><div class="matching-group-grid">${recipesInGroup.map((recipe) => cardRenderer(recipe, source === "catalog" ? catalogRecipes.indexOf(recipe) : recipes.indexOf(recipe), source)).join("")}</div></section>`;
  }).join("");
}

updateCatalogResults = function semanticUpdateCatalogResults() {
  const count = document.querySelector(".catalog-count");
  const grid = document.querySelector(".catalog-grid");
  if (!count || !grid) return;
  const filtered = orderCatalogRecipes(filteredCatalogRecipes());
  count.innerHTML = `Найдено — ${filtered.length.toString().padStart(2, "0")}${state.ingredients.length ? matchingSummary(filtered) : ""}`;
  const signature = `${filtered.map((recipe) => recipeId(recipe)).join("|")}:${state.ingredients.join("|")}:${state.priorityIngredients.join("|")}`;
  if (grid.dataset.matchingSignature === signature) return;
  grid.dataset.matchingSignature = signature;
  grid.innerHTML = filtered.length ? renderMatchingGroups(filtered, renderCatalogCard, "catalog") : `<div class="matching-empty"><h3>Строгих совпадений нет</h3><p>Уберите один фильтр или откройте варианты, где не хватает одного продукта.</p><button data-catalog-availability="one">Показать с одной покупкой</button></div>`;
};

renderResults = function semanticRenderResults() {
  if (isLoading) {
    return `<section class="results-section loading-results" aria-live="polite"><div class="results-heading"><span>Меню</span><h2>Готовим варианты</h2>${renderPotLoader("pot-loader-large")}</div><div class="loading-rule"></div><div class="loading-rule short"></div><div class="loading-rule"></div></section>`;
  }
  if (!recipes.length) {
    if (generationError) return `<section class="generation-error" id="results" aria-live="polite"><span>Для этого набора пока нет надёжного рецепта</span><p>${escapeHtml(generationError)}</p><button data-action="generate">Расширить поиск</button></section>`;
    return `<section class="manifesto-strip" aria-label="Как работает Кутно"><div><b>01</b><span>Запишите продукты</span></div><div><b>02</b><span>Отметьте технику</span></div><div><b>03</b><span>Выберите блюдо</span></div></section>`;
  }
  return `<section class="results-section matching-results" id="results" aria-labelledby="results-title">
    <div class="results-heading"><span>Меню / ${recipes.length.toString().padStart(2, "0")}</span><h2 id="results-title">Что реально<br>приготовить</h2><p>Сначала — блюда без обязательных покупок, затем варианты с заменой или одним недостающим продуктом.</p>${matchingSummary(recipes)}</div>
    ${matchingRelaxation ? `<div class="matching-relaxation"><strong>${escapeHtml(matchingRelaxation.title)}</strong><p>${escapeHtml(matchingRelaxation.details)}</p></div>` : ""}
    <div class="recipe-list matching-recipe-list">${renderMatchingGroups(recipes, renderRecipeCard, "recipes")}${hasMoreRecipes || isLoadingMore ? `<button class="load-more-recipes" data-action="load-more" ${isLoadingMore ? "disabled" : ""}><span>${isLoadingMore ? "Загружаем" : "Загрузить ещё"}</span>${isLoadingMore ? renderPotLoader("pot-loader-small") : `<span aria-hidden="true">↓</span>`}</button>` : ""}</div>
  </section>`;
};

const matchingBaseRenderKitchenView = renderKitchenView;
renderKitchenView = function semanticRenderKitchenView() {
  const baseLabel = matchingBaseIngredients().join(", ");
  return matchingBaseRenderKitchenView()
    .replace("Без покупок", "Готовить сейчас")
    .replace("Можно докупить 1", "Можно докупить")
    .replace("Использовать сначала", "Хочу использовать")
    .replace(/(<p id="ingredient-hint" class="microcopy">[\s\S]*?<\/p>)/, `$1<button type="button" class="matching-base-button" data-matching-action="base-products">Базовые продукты: ${escapeHtml(baseLabel)}</button>`);
};

function ensureMatchingBaseDialog() {
  if (document.querySelector(".matching-base-dialog")) return;
  const selected = new Set(matchingBaseIngredients().map(semanticNormalizeIngredient));
  const options = [...new Set([...SEMANTIC_DEFAULT_BASE_INGREDIENTS, "сахар", "уксус"] )];
  const wrapper = document.createElement("div");
  wrapper.className = "matching-base-dialog";
  wrapper.hidden = true;
  wrapper.innerHTML = `<button class="matching-dialog-backdrop" data-matching-action="close-base-products" aria-label="Закрыть"></button><section role="dialog" aria-modal="true" aria-labelledby="matching-base-title"><header><div><p>Настройка кухни</p><h2 id="matching-base-title">Что всегда есть дома?</h2></div><button data-matching-action="close-base-products">Закрыть ×</button></header><div class="matching-base-options">${options.map((item) => `<label><input type="checkbox" value="${escapeHtml(item)}" ${selected.has(semanticNormalizeIngredient(item)) ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("")}</div><button class="matching-base-save" data-matching-action="save-base-products">Сохранить</button></section>`;
  document.body.append(wrapper);
}

function refreshMatchingUi() {
  ensureMatchingBaseDialog();
  if (document.querySelector(".catalog-grid")) updateCatalogResults();
}

function queueMatchingRefresh() {
  if (matchingMutationQueued) return;
  matchingMutationQueued = true;
  requestAnimationFrame(() => {
    matchingMutationQueued = false;
    refreshMatchingUi();
  });
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-matching-action]")?.dataset.matchingAction;
  if (action === "base-products") {
    ensureMatchingBaseDialog();
    document.querySelector(".matching-base-dialog").hidden = false;
    document.documentElement.classList.add("matching-dialog-open");
  }
  if (action === "close-base-products") {
    document.querySelector(".matching-base-dialog").hidden = true;
    document.documentElement.classList.remove("matching-dialog-open");
  }
  if (action === "save-base-products") {
    const values = [...document.querySelectorAll(".matching-base-options input:checked")].map((input) => input.value);
    localStorage.setItem(MATCHING_BASE_KEY, JSON.stringify(values.length ? values : SEMANTIC_DEFAULT_BASE_INGREDIENTS));
    document.querySelector(".matching-base-dialog").hidden = true;
    document.documentElement.classList.remove("matching-dialog-open");
    catalogRecipes = [];
    recipes = [];
    renderMainView();
  }
}, true);

new MutationObserver(queueMatchingRefresh).observe(document.documentElement, { childList: true, subtree: true });
if (currentView === "kitchen") renderMainView();
else queueMatchingRefresh();
