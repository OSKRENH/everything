const CATALOG_INITIAL_SIZE = 5;
const CATALOG_INCREMENT = 1;
const CATALOG_RETRY_COUNT = 3;
const CATALOG_REVEAL_DURATION = 480;
let catalogVisibleLimit = CATALOG_INITIAL_SIZE;
let catalogResultKey = "";
let catalogLoadObserver = null;
let catalogLoadPending = false;
let catalogAnimateNext = false;
let catalogRecoveryTimer = 0;

function catalogDelay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/*
 * Первый запрос каталога иногда временно падает на мобильном Safari.
 * Не показываем ошибку после одной неудачи: повторяем запрос автоматически,
 * а ручную кнопку оставляем только как последний запасной вариант.
 */
loadCatalog = async function resilientCatalogLoad(force = false) {
  if ((catalogRecipes.length && !force) || catalogLoading) return;
  catalogLoading = true;
  catalogError = "";
  renderMainView();

  let loaded = false;
  let lastError = null;
  for (let attempt = 0; attempt < CATALOG_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(`/api/catalog?portions=${state.portions}`, {
        cache: "no-store",
        headers: { "x-kutno-catalog-attempt": String(attempt + 1) },
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.recipes)) {
        throw new Error(data.error || "Не удалось открыть базу рецептов");
      }
      catalogRecipes = orderCatalogRecipes(data.recipes);
      resetSwipeDeck();
      loaded = true;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < CATALOG_RETRY_COUNT - 1) await catalogDelay(350 * (attempt + 1));
    }
  }

  catalogError = loaded
    ? ""
    : lastError instanceof Error
      ? lastError.message
      : "Не удалось открыть базу рецептов";
  catalogLoading = false;
  renderMainView();
};

function recoverInitialCatalogLoad() {
  window.clearTimeout(catalogRecoveryTimer);
  catalogRecoveryTimer = window.setTimeout(async function recover() {
    if (currentView !== "catalog" || catalogRecipes.length) return;
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
  return `<div class="catalog-scroll-sentinel" data-catalog-scroll-sentinel aria-hidden="true">
    <span>Ещё ${left}</span>
  </div>`;
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

  return items.length > limit
    ? `${markup}${catalogScrollSentinel(items.length - limit)}`
    : markup;
}

function renderPlainCatalogLimited(items, limit) {
  const visible = items.slice(0, limit);
  const cards = visible.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("");
  return items.length > limit
    ? `${cards}${catalogScrollSentinel(items.length - limit)}`
    : cards;
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
  const header = group?.querySelector(":scope > header") || null;
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
    window.addEventListener("scroll", onScroll, { passive: true, once: false });
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

  const quickKey = catalogQuickKey();
  if (grid.dataset.catalogPerformanceKey === quickKey) return;

  const filtered = orderCatalogRecipes(filteredCatalogRecipes());
  const nextResultKey = catalogFilteredKey(filtered);
  if (catalogResultKey !== nextResultKey) {
    catalogResultKey = nextResultKey;
    catalogVisibleLimit = CATALOG_INITIAL_SIZE;
    catalogAnimateNext = false;
    catalogLoadPending = false;
  }

  const finalQuickKey = catalogQuickKey();
  grid.dataset.catalogPerformanceKey = finalQuickKey;
  count.innerHTML = `Найдено — ${filtered.length.toString().padStart(2, "0")}${state.ingredients.length ? matchingSummary(filtered) : ""}`;

  if (!filtered.length) {
    grid.innerHTML = state.ingredients.length
      ? `<div class="matching-empty"><h3>Строгих совпадений нет</h3><p>Уберите один фильтр или откройте варианты, где не хватает одного продукта.</p><button data-catalog-availability="one">Показать с одной покупкой</button></div>`
      : `<p class="catalog-empty">Ничего не нашлось. Попробуйте убрать один из фильтров.</p>`;
    return;
  }

  grid.innerHTML = state.ingredients.length
    ? renderCatalogGroupsLimited(filtered, catalogVisibleLimit)
    : renderPlainCatalogLimited(filtered, catalogVisibleLimit);

  const animated = animateNewCatalogCard(grid);
  if (!animated) requestAnimationFrame(armCatalogAutoLoad);
};

recoverInitialCatalogLoad();
