const CATALOG_INITIAL_SIZE = 5;
const CATALOG_INCREMENT = 1;
const CATALOG_RETRY_COUNT = 3;
const CATALOG_REVEAL_DURATION = 480;
const catalogDirectFetch = typeof kutnoFetchBeforeMatching === "function"
  ? kutnoFetchBeforeMatching
  : window.fetch.bind(window);
let catalogVisibleLimit = CATALOG_INITIAL_SIZE;
let catalogResultKey = "";
let catalogLoadObserver = null;
let catalogLoadPending = false;
let catalogAnimateNext = false;
let catalogRecoveryTimer = 0;
let catalogUsingFallback = false;

function catalogDelay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function safeCatalogRecipes(recipesToUse) {
  const source = Array.isArray(recipesToUse) ? recipesToUse.filter((recipe) => recipe?.title) : [];
  try {
    return orderCatalogRecipes(source);
  } catch {
    return source;
  }
}

function applyCatalogRecipes(recipesToUse, { fallback = false } = {}) {
  catalogRecipes = safeCatalogRecipes(recipesToUse);
  catalogUsingFallback = fallback;
  try {
    resetSwipeDeck();
  } catch {
    swipeRecipes = [...catalogRecipes];
    swipeIndex = 0;
  }
}

function localCatalogFallback() {
  try {
    return fallbackRecipes.map((recipe) => scaledFallbackRecipe(recipe, state.portions));
  } catch {
    return [];
  }
}

async function requestCatalogDirectly() {
  const portions = Math.max(1, Number(state.portions) || 2);
  const response = await catalogDirectFetch(`/api/catalog?portions=${encodeURIComponent(String(portions))}`);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Каталог вернул некорректный ответ");
  }
  if (!response.ok || !Array.isArray(data.recipes)) {
    throw new Error(typeof data.error === "string" ? data.error : "Не удалось открыть базу рецептов");
  }
  return data.recipes;
}

function scheduleFullCatalogRecovery() {
  window.clearTimeout(catalogRecoveryTimer);
  catalogRecoveryTimer = window.setTimeout(async () => {
    if (currentView !== "catalog" || catalogLoading || !catalogUsingFallback) return;
    await loadCatalog(true);
  }, 1800);
}

/*
 * Каталог не должен падать целиком из-за одного временного запроса или рецепта.
 * Три раза пробуем получить полный список напрямую. Если сеть не отвечает,
 * сразу показываем встроенную базу и продолжаем восстановление в фоне.
 */
loadCatalog = async function resilientCatalogLoad(force = false) {
  if ((catalogRecipes.length && !force && !catalogUsingFallback) || catalogLoading) return;
  catalogLoading = true;
  catalogError = "";
  renderMainView();

  let loaded = false;
  for (let attempt = 0; attempt < CATALOG_RETRY_COUNT; attempt += 1) {
    try {
      const recipesFromApi = await requestCatalogDirectly();
      applyCatalogRecipes(recipesFromApi);
      loaded = true;
      break;
    } catch {
      if (attempt < CATALOG_RETRY_COUNT - 1) await catalogDelay(300 * (attempt + 1));
    }
  }

  if (!loaded) {
    const fallback = localCatalogFallback();
    if (fallback.length) {
      applyCatalogRecipes(fallback, { fallback: true });
      catalogError = "";
    } else {
      catalogError = "Не удалось открыть базу рецептов";
    }
  }

  catalogLoading = false;
  renderMainView();
  if (catalogUsingFallback) scheduleFullCatalogRecovery();
};

function recoverInitialCatalogLoad() {
  window.clearTimeout(catalogRecoveryTimer);
  catalogRecoveryTimer = window.setTimeout(async function recover() {
    if (currentView !== "catalog" || (catalogRecipes.length && !catalogUsingFallback)) return;
    if (catalogLoading) {
      catalogRecoveryTimer = window.setTimeout(recover, 250);
      return;
    }
    await loadCatalog(true);
  }, 300);
}

function catalogQuickKey() {
  return [
    catalogRecipes.map((recipe) => recipeId(recipe)).join("|"),
    favoriteRecipes.map((recipe) => recipeId(recipe)).join("|"),
    state.ingredients.join("|"),
    state.priorityIngredients.join("|"),
    state.equipment.join("|"),
    matchingBaseIngredients().join("|"),
    catalogQuery,
    catalogCuisine,
    catalogDifficulty,
    catalogCourse,
    catalogProtein,
    catalogAvailability,
    catalogMaxMinutes,
    catalogVisibleLimit,
  ].join("::");
}

function catalogFilteredKey(items) {
  return [
    items.map((recipe) => recipeId(recipe)).join("|"),
    state.ingredients.join("|"),
    state.priorityIngredients.join("|"),
    state.equipment.join("|"),
    matchingBaseIngredients().join("|"),
    catalogQuery,
    catalogCuisine,
    catalogDifficulty,
    catalogCourse,
    catalogProtein,
    catalogAvailability,
    catalogMaxMinutes,
  ].join("::");
}

function catalogScrollSentinel(left) {
  return `<div class="catalog-scroll-sentinel" data-catalog-scroll-sentinel aria-hidden="true"><span>Ещё ${left}</span></div>`;
}

function renderCatalogGroupsLimited(items, limit) {
  const groups = matchingGroupRecipes(items);
  let remaining = limit;
  const markup = ["ready", "substitute", "one", "more"].map((group) => {
    if (remaining <= 0) return "";
    const allInGroup = groups[group];
    if (!allInGroup.length) return "";
    const visible = allInGroup.slice(0, remaining);
    remaining -= visible.length;
    const meta = matchingGroupMeta(group);
    return `<section class="matching-group matching-group-${group}">
      <header>
        <div><span>${String(allInGroup.length).padStart(2, "0")}</span><h3>${escapeHtml(meta.title)}</h3></div>
        <p>${escapeHtml(meta.note)}</p>
      </header>
      <div class="matching-group-grid">${visible.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("")}</div>
    </section>`;
  }).join("");
  return items.length > limit ? `${markup}${catalogScrollSentinel(items.length - limit)}` : markup;
}

function renderPlainCatalogLimited(items, limit) {
  const visible = items.slice(0, limit);
  const cards = visible.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("");
  return items.length > limit ? `${cards}${catalogScrollSentinel(items.length - limit)}` : cards;
}

function finishCatalogReveal(card, header) {
  card?.classList.remove("catalog-card-entering");
  header?.classList.remove("matching-group-header-entering");
  catalogLoadPending = false;
  armCatalogAutoLoad();
}

function animateNewCatalogCard(grid) {
  if (!catalogAnimateNext) return false;
  catalogAnimateNext = false;
  const cards = [...grid.querySelectorAll(".catalog-card")];
  const card = cards.at(-1);
  if (!card) {
    catalogLoadPending = false;
    return false;
  }
  const group = card.closest(".matching-group");
  const header = group ? group.querySelector("header") : null;
  const startsNewGroup = Boolean(group && group.querySelectorAll(".catalog-card").length === 1);
  card.classList.add("catalog-card-entering");
  if (startsNewGroup) header?.classList.add("matching-group-header-entering");
  window.setTimeout(() => finishCatalogReveal(card, startsNewGroup ? header : null), CATALOG_REVEAL_DURATION + 60);
  return true;
}

function revealNextCatalogItem() {
  if (catalogLoadPending) return;
  catalogLoadPending = true;
  catalogAnimateNext = true;
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;
  catalogVisibleLimit += CATALOG_INCREMENT;
  updateCatalogResults();
}

function armCatalogAutoLoad() {
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;
  const sentinel = document.querySelector("[data-catalog-scroll-sentinel]");
  if (!sentinel || catalogLoadPending) return;
  if (typeof IntersectionObserver === "undefined") {
    const onScroll = () => {
      if (sentinel.getBoundingClientRect().top > window.innerHeight + 60) return;
      window.removeEventListener("scroll", onScroll);
      revealNextCatalogItem();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return;
  }
  catalogLoadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    revealNextCatalogItem();
  }, { rootMargin: "60px 0px" });
  catalogLoadObserver.observe(sentinel);
}

updateCatalogResults = function performantCatalogResults() {
  const count = document.querySelector(".catalog-count");
  const grid = document.querySelector(".catalog-grid");
  if (!count || !grid) return;

  let filtered = [];
  try {
    filtered = orderCatalogRecipes(filteredCatalogRecipes());
  } catch {
    filtered = [...catalogRecipes];
  }

  let quickKey = "";
  try {
    quickKey = catalogQuickKey();
    if (grid.dataset.catalogPerformanceKey === quickKey) return;
  } catch {
    quickKey = String(Date.now());
  }

  let nextResultKey = "";
  try {
    nextResultKey = catalogFilteredKey(filtered);
  } catch {
    nextResultKey = filtered.map((recipe) => String(recipe?.title || "")).join("|");
  }
  if (catalogResultKey !== nextResultKey) {
    catalogResultKey = nextResultKey;
    catalogVisibleLimit = CATALOG_INITIAL_SIZE;
    catalogAnimateNext = false;
    catalogLoadPending = false;
  }

  grid.dataset.catalogPerformanceKey = quickKey;
  count.innerHTML = `Найдено — ${filtered.length.toString().padStart(2, "0")}${state.ingredients.length ? matchingSummary(filtered) : ""}`;

  if (!filtered.length) {
    grid.innerHTML = `<p class="catalog-empty">Ничего не нашлось. Попробуйте убрать один из фильтров.</p>`;
    return;
  }

  try {
    grid.innerHTML = state.ingredients.length
      ? renderCatalogGroupsLimited(filtered, catalogVisibleLimit)
      : renderPlainCatalogLimited(filtered, catalogVisibleLimit);
  } catch {
    grid.innerHTML = renderPlainCatalogLimited(filtered, catalogVisibleLimit);
  }

  const animated = animateNewCatalogCard(grid);
  if (!animated) requestAnimationFrame(armCatalogAutoLoad);
};

recoverInitialCatalogLoad();
