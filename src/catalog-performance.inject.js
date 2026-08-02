const CATALOG_BATCH_SIZE = 12;
let catalogVisibleLimit = CATALOG_BATCH_SIZE;
let catalogResultKey = "";
let catalogLoadObserver = null;

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

  if (items.length <= limit) return markup;
  const left = items.length - limit;
  const next = Math.min(CATALOG_BATCH_SIZE, left);
  return `${markup}<button type="button" class="catalog-load-more" data-catalog-load-more>
    <span>Показать ещё</span><small>ещё ${next} из ${left}</small>
  </button>`;
}

function renderPlainCatalogLimited(items, limit) {
  const visible = items.slice(0, limit);
  const cards = visible.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("");
  if (items.length <= limit) return cards;
  const left = items.length - limit;
  const next = Math.min(CATALOG_BATCH_SIZE, left);
  return `${cards}<button type="button" class="catalog-load-more" data-catalog-load-more>
    <span>Показать ещё</span><small>ещё ${next} из ${left}</small>
  </button>`;
}

function armCatalogAutoLoad() {
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;
  const button = document.querySelector("[data-catalog-load-more]");
  if (!button || typeof IntersectionObserver === "undefined") return;
  catalogLoadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    catalogLoadObserver?.disconnect();
    catalogLoadObserver = null;
    catalogVisibleLimit += CATALOG_BATCH_SIZE;
    updateCatalogResults();
  }, { rootMargin: "500px 0px" });
  catalogLoadObserver.observe(button);
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
    catalogVisibleLimit = CATALOG_BATCH_SIZE;
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
  requestAnimationFrame(armCatalogAutoLoad);
};

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-catalog-load-more]");
  if (!button) return;
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;
  catalogVisibleLimit += CATALOG_BATCH_SIZE;
  updateCatalogResults();
});
