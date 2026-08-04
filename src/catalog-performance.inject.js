const CATALOG_INITIAL_SIZE = 5;
const CATALOG_PAGE_SIZE = 5;
const CATALOG_INCREMENT = 1;
const CATALOG_RETRY_COUNT = 3;
const CATALOG_BACKGROUND_RECOVERY_LIMIT = 2;
const CATALOG_REVEAL_DURATION = 480;
let catalogVisibleLimit = CATALOG_INITIAL_SIZE;
let catalogResultKey = "";
let catalogFilterKey = "";
let catalogLoadObserver = null;
let catalogLoadPending = false;
let catalogAnimateNext = false;
let catalogInitialRecoveryTimer = 0;
let catalogBackgroundRecoveryTimer = 0;
let catalogBackgroundRecoveryAttempts = 0;
let catalogBackgroundRecoveryInFlight = false;
let catalogUsingFallback = false;
let catalogNextCursor = "";
let catalogTotal = 0;
let catalogPageLoading = false;
let catalogLastFilteredCount = 0;

function catalogDelay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function preferenceAdjustedRecipes(recipesToUse) {
  return recipesToUse.map((recipe, index) => ({
    recipe,
    index,
    penalty: Number(window.kutnoPreferencePenalty?.(recipe)) || 0,
    boost: Number(window.kutnoExpiryBoost?.(recipe)) || 0,
  })).sort((first, second) => (first.penalty - first.boost) - (second.penalty - second.boost) || first.index - second.index)
    .map(({ recipe }) => recipe);
}

function safeCatalogRecipes(recipesToUse) {
  const source = Array.isArray(recipesToUse) ? recipesToUse.filter((recipe) => recipe?.title) : [];
  try {
    return preferenceAdjustedRecipes(orderCatalogRecipes(source));
  } catch {
    return preferenceAdjustedRecipes(source);
  }
}

function mergeCatalogRecipes(existing, incoming) {
  const seen = new Set();
  return safeCatalogRecipes([...existing, ...incoming].filter((recipe) => {
    const id = recipeId(recipe);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }));
}

function applyCatalogPage(page, { replace = false, fallback = false } = {}) {
  const incoming = Array.isArray(page?.recipes) ? page.recipes : [];
  catalogRecipes = replace ? safeCatalogRecipes(incoming) : mergeCatalogRecipes(catalogRecipes, incoming);
  catalogNextCursor = typeof page?.nextCursor === "string" ? page.nextCursor : "";
  catalogTotal = Math.max(catalogRecipes.length, Number(page?.total) || catalogRecipes.length);
  catalogUsingFallback = fallback;
  try {
    if (replace) resetSwipeDeck();
    else {
      const known = new Set(swipeRecipes.map((recipe) => recipeId(recipe)));
      swipeRecipes.push(...incoming.filter((recipe) => !known.has(recipeId(recipe))));
    }
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

async function requestCatalogPage(cursor = "") {
  const portions = Math.max(1, Number(state.portions) || 2);
  const data = await kutnoApi.catalogPage({ portions, limit: CATALOG_PAGE_SIZE, cursor });
  if (!Array.isArray(data.recipes)) throw new Error("Каталог вернул некорректный ответ");
  return data;
}

function stopCatalogRecovery() {
  window.clearTimeout(catalogInitialRecoveryTimer);
  window.clearTimeout(catalogBackgroundRecoveryTimer);
  catalogInitialRecoveryTimer = 0;
  catalogBackgroundRecoveryTimer = 0;
}

async function loadNextCatalogPage() {
  if (!catalogNextCursor || catalogPageLoading || catalogUsingFallback) return false;
  catalogPageLoading = true;
  try {
    const page = await requestCatalogPage(catalogNextCursor);
    applyCatalogPage(page);
    catalogError = "";
    return true;
  } catch {
    return false;
  } finally {
    catalogPageLoading = false;
  }
}

window.kutnoLoadNextCatalogPage = async function kutnoLoadNextCatalogPage() {
  const loaded = await loadNextCatalogPage();
  if (loaded && currentView === "catalog") updateCatalogResults();
  return loaded;
};

async function recoverFullCatalogSilently() {
  if (
    currentView !== "catalog"
    || !catalogUsingFallback
    || catalogBackgroundRecoveryInFlight
    || catalogBackgroundRecoveryAttempts >= CATALOG_BACKGROUND_RECOVERY_LIMIT
  ) return;

  catalogBackgroundRecoveryInFlight = true;
  catalogBackgroundRecoveryAttempts += 1;
  try {
    const page = await requestCatalogPage();
    applyCatalogPage(page, { replace: true });
    catalogBackgroundRecoveryAttempts = 0;
    catalogError = "";
    renderMainView();
  } catch {
    if (catalogBackgroundRecoveryAttempts < CATALOG_BACKGROUND_RECOVERY_LIMIT) {
      scheduleFullCatalogRecovery(4000 * catalogBackgroundRecoveryAttempts);
    }
  } finally {
    catalogBackgroundRecoveryInFlight = false;
  }
}

function scheduleFullCatalogRecovery(delay = 4000) {
  window.clearTimeout(catalogBackgroundRecoveryTimer);
  catalogBackgroundRecoveryTimer = 0;
  if (!catalogUsingFallback || catalogBackgroundRecoveryAttempts >= CATALOG_BACKGROUND_RECOVERY_LIMIT) return;
  catalogBackgroundRecoveryTimer = window.setTimeout(recoverFullCatalogSilently, delay);
}

/*
 * При первом открытии трижды пробуем получить первую серверную страницу.
 * Если сеть не отвечает, показываем встроенную базу. Фоновое восстановление
 * не включает загрузчик и ограничено двумя попытками.
 */
loadCatalog = async function resilientCatalogLoad(force = false) {
  if ((catalogRecipes.length && !force) || catalogLoading) return;
  catalogLoading = true;
  catalogError = "";
  if (force) {
    catalogNextCursor = "";
    catalogTotal = 0;
    catalogVisibleLimit = CATALOG_INITIAL_SIZE;
  }
  renderMainView();

  let loaded = false;
  for (let attempt = 0; attempt < CATALOG_RETRY_COUNT; attempt += 1) {
    try {
      const page = await requestCatalogPage();
      applyCatalogPage(page, { replace: true });
      catalogBackgroundRecoveryAttempts = 0;
      loaded = true;
      break;
    } catch {
      if (attempt < CATALOG_RETRY_COUNT - 1) await catalogDelay(300 * (attempt + 1));
    }
  }

  if (!loaded) {
    const fallback = localCatalogFallback();
    if (fallback.length) {
      applyCatalogPage({ recipes: fallback, total: fallback.length, nextCursor: "" }, { replace: true, fallback: true });
      catalogError = "";
    } else {
      catalogError = "Не удалось открыть базу рецептов";
    }
  }

  catalogLoading = false;
  renderMainView();
  if (catalogUsingFallback) scheduleFullCatalogRecovery();
};

function recoverInitialCatalogLoad(attempt = 0) {
  window.clearTimeout(catalogInitialRecoveryTimer);
  catalogInitialRecoveryTimer = window.setTimeout(() => {
    if (currentView !== "catalog" || catalogRecipes.length) return;
    if (catalogLoading) {
      if (attempt < 8) recoverInitialCatalogLoad(attempt + 1);
      return;
    }
    loadCatalog();
  }, attempt ? 250 : 300);
}

function currentCatalogFilterKey() {
  return [
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

function catalogQuickKey() {
  return [
    catalogRecipes.map((recipe) => recipeId(recipe)).join("|"),
    favoriteRecipes.map((recipe) => recipeId(recipe)).join("|"),
    currentCatalogFilterKey(),
    catalogVisibleLimit,
    catalogNextCursor,
    catalogPageLoading,
  ].join("::");
}

function catalogScrollSentinel(left) {
  const text = left > 0 ? `Ещё ${left}` : "Ещё рецепты";
  return `<div class="catalog-scroll-sentinel" data-catalog-scroll-sentinel aria-hidden="true"><span>${text}</span></div>`;
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
  const hasMore = items.length > limit || Boolean(catalogNextCursor);
  return hasMore ? `${markup}${catalogScrollSentinel(Math.max(0, catalogTotal - Math.min(catalogTotal, limit)))}` : markup;
}

function renderPlainCatalogLimited(items, limit) {
  const visible = items.slice(0, limit);
  const cards = visible.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("");
  const hasMore = items.length > limit || Boolean(catalogNextCursor);
  return hasMore ? `${cards}${catalogScrollSentinel(Math.max(0, catalogTotal - Math.min(catalogTotal, limit)))}` : cards;
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

async function revealNextCatalogItem() {
  if (catalogLoadPending) return;
  catalogLoadPending = true;
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;

  if (catalogVisibleLimit >= catalogLastFilteredCount && catalogNextCursor) {
    await loadNextCatalogPage();
  }

  if (catalogVisibleLimit < catalogRecipes.length || catalogNextCursor) {
    catalogAnimateNext = true;
    catalogVisibleLimit += CATALOG_INCREMENT;
  }
  catalogLoadPending = false;
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
    filtered = safeCatalogRecipes(filteredCatalogRecipes());
  } catch {
    filtered = safeCatalogRecipes(catalogRecipes);
  }
  catalogLastFilteredCount = filtered.length;

  const nextFilterKey = currentCatalogFilterKey();
  if (catalogFilterKey !== nextFilterKey) {
    catalogFilterKey = nextFilterKey;
    catalogVisibleLimit = CATALOG_INITIAL_SIZE;
    catalogAnimateNext = false;
    catalogLoadPending = false;
  }

  let quickKey = "";
  try {
    quickKey = catalogQuickKey();
    if (grid.dataset.catalogPerformanceKey === quickKey) return;
  } catch {
    quickKey = String(Date.now());
  }

  catalogResultKey = filtered.map((recipe) => recipeId(recipe)).join("|");
  grid.dataset.catalogPerformanceKey = quickKey;
  const totalLabel = catalogTotal > filtered.length ? ` из ${catalogTotal}` : "";
  count.innerHTML = `Загружено — ${filtered.length.toString().padStart(2, "0")}${totalLabel}${state.ingredients.length ? matchingSummary(filtered) : ""}`;

  if (!filtered.length) {
    grid.innerHTML = catalogNextCursor
      ? `${catalogScrollSentinel(catalogTotal)}<p class="catalog-empty">Ищем подходящие рецепты дальше…</p>`
      : `<p class="catalog-empty">Ничего не нашлось. Попробуйте убрать один из фильтров.</p>`;
    requestAnimationFrame(armCatalogAutoLoad);
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

window.addEventListener("hashchange", () => {
  if (location.hash !== "#catalog") stopCatalogRecovery();
});

recoverInitialCatalogLoad();