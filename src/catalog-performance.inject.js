const CATALOG_INITIAL_SIZE = 5;
const CATALOG_PAGE_SIZE = 5;
const CATALOG_INCREMENT = 1;
const CATALOG_RETRY_COUNT = 3;
const CATALOG_BACKGROUND_RECOVERY_LIMIT = 2;
const CATALOG_REVEAL_DURATION = 480;
const CATALOG_EMPTY_PAGE_LIMIT = 5;
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
let catalogPageError = "";
let catalogSeenCursors = new Set();

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

function recipeIdentity(recipe) {
  try {
    return recipeId(recipe);
  } catch {
    return String(recipe?.id || recipe?.source?.id || recipe?.title || "");
  }
}

function mergeCatalogRecipes(existing, incoming) {
  const known = new Set(existing.map(recipeIdentity).filter(Boolean));
  const uniqueIncoming = [];
  for (const recipe of incoming) {
    const id = recipeIdentity(recipe);
    if (!id || known.has(id)) continue;
    known.add(id);
    uniqueIncoming.push(recipe);
  }
  return {
    recipes: safeCatalogRecipes([...existing, ...uniqueIncoming]),
    added: uniqueIncoming.length,
  };
}

function applyCatalogPage(page, { replace = false, fallback = false } = {}) {
  const incoming = Array.isArray(page?.recipes) ? page.recipes : [];
  let added = incoming.length;
  if (replace) {
    catalogRecipes = safeCatalogRecipes(incoming);
    catalogSeenCursors = new Set();
  } else {
    const merged = mergeCatalogRecipes(catalogRecipes, incoming);
    catalogRecipes = merged.recipes;
    added = merged.added;
  }
  catalogNextCursor = typeof page?.nextCursor === "string" ? page.nextCursor : "";
  catalogTotal = Math.max(catalogRecipes.length, Number(page?.total) || catalogRecipes.length);
  catalogUsingFallback = fallback;
  catalogPageError = "";
  try {
    if (replace) resetSwipeDeck();
    else {
      const known = new Set(swipeRecipes.map(recipeIdentity));
      swipeRecipes.push(...incoming.filter((recipe) => !known.has(recipeIdentity(recipe))));
    }
  } catch {
    swipeRecipes = [...catalogRecipes];
    swipeIndex = 0;
  }
  return added;
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
  const cursor = catalogNextCursor;
  if (!cursor || catalogPageLoading || catalogUsingFallback) return { loaded: false, added: 0 };
  if (catalogSeenCursors.has(cursor)) {
    catalogNextCursor = "";
    catalogPageError = "Каталог остановил повторяющуюся страницу";
    kutnoApi.telemetry("catalog_cursor_loop", { cursor: cursor.slice(0, 40), loaded: catalogRecipes.length }, "error");
    return { loaded: false, added: 0 };
  }

  catalogSeenCursors.add(cursor);
  catalogPageLoading = true;
  try {
    const page = await requestCatalogPage(cursor);
    if (page.nextCursor === cursor) {
      page.nextCursor = "";
      kutnoApi.telemetry("catalog_cursor_not_advanced", { cursor: cursor.slice(0, 40) }, "error");
    }
    const added = applyCatalogPage(page);
    catalogError = "";
    kutnoApi.telemetry("catalog_page_loaded", {
      added,
      loaded: catalogRecipes.length,
      total: catalogTotal,
      hasMore: Boolean(catalogNextCursor),
    }, "debug");
    return { loaded: true, added };
  } catch (error) {
    catalogSeenCursors.delete(cursor);
    catalogPageError = error instanceof Error ? error.message : "Не удалось загрузить следующую страницу";
    kutnoApi.telemetry("catalog_page_failed", { message: catalogPageError, loaded: catalogRecipes.length }, "error");
    return { loaded: false, added: 0 };
  } finally {
    catalogPageLoading = false;
  }
}

window.kutnoLoadNextCatalogPage = async function kutnoLoadNextCatalogPage() {
  const result = await loadNextCatalogPage();
  if (result.loaded && currentView === "catalog") updateCatalogResults();
  return result.loaded;
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

loadCatalog = async function resilientCatalogLoad(force = false) {
  if ((catalogRecipes.length && !force) || catalogLoading) return;
  catalogLoading = true;
  catalogError = "";
  catalogPageError = "";
  if (force) {
    catalogNextCursor = "";
    catalogTotal = 0;
    catalogVisibleLimit = CATALOG_INITIAL_SIZE;
    catalogSeenCursors = new Set();
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

function currentFilteredCatalog() {
  try {
    return safeCatalogRecipes(filteredCatalogRecipes());
  } catch {
    return safeCatalogRecipes(catalogRecipes);
  }
}

function catalogQuickKey() {
  return [
    catalogRecipes.map(recipeIdentity).join("|"),
    favoriteRecipes.map(recipeIdentity).join("|"),
    currentCatalogFilterKey(),
    catalogVisibleLimit,
    catalogNextCursor,
    catalogPageLoading,
    catalogPageError,
  ].join("::");
}

function catalogScrollSentinel(left) {
  const text = catalogPageError ? "Повторить загрузку" : left > 0 ? `Ещё ${left}` : "Ещё рецепты";
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
  const left = Math.max(0, catalogTotal - Math.min(catalogTotal, limit));
  return hasMore ? `${markup}${catalogScrollSentinel(left)}` : markup;
}

function renderPlainCatalogLimited(items, limit) {
  const visible = items.slice(0, limit);
  const cards = visible.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("");
  const hasMore = items.length > limit || Boolean(catalogNextCursor);
  const left = Math.max(0, catalogTotal - Math.min(catalogTotal, limit));
  return hasMore ? `${cards}${catalogScrollSentinel(left)}` : cards;
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

async function loadUntilNextFilteredRecipe(previousFilteredCount) {
  let attempts = 0;
  let filteredCount = previousFilteredCount;
  while (catalogNextCursor && attempts < CATALOG_EMPTY_PAGE_LIMIT && filteredCount <= previousFilteredCount) {
    const result = await loadNextCatalogPage();
    if (!result.loaded) break;
    attempts += 1;
    filteredCount = currentFilteredCatalog().length;
  }
  return filteredCount;
}

async function revealNextCatalogItem() {
  if (catalogLoadPending) return;
  catalogLoadPending = true;
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;

  let filtered = currentFilteredCatalog();
  if (catalogVisibleLimit >= filtered.length && catalogNextCursor) {
    await loadUntilNextFilteredRecipe(filtered.length);
    filtered = currentFilteredCatalog();
  }

  if (catalogVisibleLimit < filtered.length) {
    catalogAnimateNext = true;
    catalogVisibleLimit += CATALOG_INCREMENT;
  }

  updateCatalogResults();
  if (!catalogAnimateNext) {
    catalogLoadPending = false;
    requestAnimationFrame(armCatalogAutoLoad);
  }
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

  const filtered = currentFilteredCatalog();
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

  catalogResultKey = filtered.map(recipeIdentity).join("|");
  grid.dataset.catalogPerformanceKey = quickKey;
  const loadedLabel = catalogTotal > catalogRecipes.length ? ` из ${catalogTotal}` : "";
  count.innerHTML = `Загружено — ${catalogRecipes.length.toString().padStart(2, "0")}${loadedLabel}${state.ingredients.length ? matchingSummary(filtered) : ""}`;

  if (!filtered.length) {
    grid.innerHTML = catalogNextCursor
      ? `${catalogScrollSentinel(Math.max(0, catalogTotal - catalogRecipes.length))}<p class="catalog-empty">Ищем подходящие рецепты дальше…</p>`
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
