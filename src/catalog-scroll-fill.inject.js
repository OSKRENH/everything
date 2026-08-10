const finishCatalogRevealBeforeViewportFillV6 = finishCatalogReveal;
let catalogViewportFillQueuedV6 = false;

function continueCatalogViewportFillV6() {
  catalogViewportFillQueuedV6 = false;
  if (currentView !== "catalog" || catalogLoadPending) return;
  const sentinel = document.querySelector("[data-catalog-scroll-sentinel]");
  if (!sentinel || !sentinelIsNearViewport(sentinel)) return;
  if (!catalogNextCursor && catalogVisibleLimit >= currentFilteredCatalog().length) return;

  // Пользователь уже дошёл до конца списка. Если новая карточка всё ещё не
  // вытолкнула маркер за экран, раскрываем следующую, чтобы не требовать
  // фиктивного дополнительного scroll-события от браузера.
  catalogScrollVersion += 1;
  revealNextCatalogItem();
}

function scheduleCatalogViewportFillV6() {
  if (catalogViewportFillQueuedV6) return;
  catalogViewportFillQueuedV6 = true;
  requestAnimationFrame(continueCatalogViewportFillV6);
}

finishCatalogReveal = function finishCatalogRevealWithViewportFillV6(card, header) {
  finishCatalogRevealBeforeViewportFillV6(card, header);
  scheduleCatalogViewportFillV6();
};

const CATALOG_INITIAL_VISIBLE_V8 = 12;
const CATALOG_API_PAGE_SIZE_V8 = 12;
const updateCatalogResultsBeforeShowMoreV8 = updateCatalogResults;
const loadCatalogBeforeShowMoreV8 = loadCatalog;

function catalogColumnCountV8() {
  if (window.matchMedia?.("(max-width: 700px)")?.matches) return 1;
  if (window.matchMedia?.("(max-width: 980px)")?.matches) return 2;
  return 3;
}

function catalogRevealBatchV8() {
  return Math.max(1, catalogColumnCountV8());
}

function ensureCatalogVisibleBatchV8() {
  if (catalogVisibleLimit < CATALOG_INITIAL_VISIBLE_V8) catalogVisibleLimit = CATALOG_INITIAL_VISIBLE_V8;
}

requestCatalogPage = async function requestCatalogPageTwelveV8(cursor = "") {
  const portions = Math.max(1, Number(state.portions) || 2);
  const data = await kutnoApi.catalogPage({
    portions,
    limit: CATALOG_API_PAGE_SIZE_V8,
    cursor,
  });
  if (!Array.isArray(data.recipes)) throw new Error("Каталог вернул некорректный ответ");
  const total = Number(data.total) || 0;
  if (total > 0) {
    catalogTotal = Math.max(catalogTotal, total);
    if (typeof catalogMetadataTotal !== "undefined") catalogMetadataTotal = Math.max(catalogMetadataTotal, total);
  }
  return data;
};

catalogScrollSentinel = function catalogShowMoreButtonV8(left) {
  const label = catalogPageError ? "Повторить загрузку" : "Показать ещё";
  const nextBatch = Math.min(catalogRevealBatchV8(), Math.max(0, left));
  const remaining = left > 0 ? `<span>${nextBatch} из ${left}</span>` : "";
  return `<div class="catalog-scroll-sentinel catalog-show-more-wrap" data-catalog-scroll-sentinel><button class="catalog-show-more" type="button" data-catalog-show-more>${label}${remaining}</button></div>`;
};

sentinelIsNearViewport = function sentinelIsNearViewportManualV8() {
  return false;
};

armCatalogAutoLoad = function armCatalogManualLoadV8() {
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;
};

revealNextCatalogItem = async function revealNextCatalogRowV8() {
  if (catalogLoadPending) return;
  catalogLoadPending = true;
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;

  const batch = catalogRevealBatchV8();
  const target = Math.max(CATALOG_INITIAL_VISIBLE_V8, catalogVisibleLimit) + batch;
  let filtered = currentFilteredCatalog();
  let attempts = 0;

  while (catalogNextCursor && filtered.length < target && attempts < 20) {
    const result = await loadNextCatalogPage();
    if (!result.loaded) break;
    attempts += 1;
    filtered = currentFilteredCatalog();
  }

  catalogVisibleLimit = target;
  catalogAnimateNext = false;
  catalogLoadPending = false;
  updateCatalogResults();
};

updateCatalogResults = function updateCatalogResultsResponsiveV8() {
  ensureCatalogVisibleBatchV8();
  updateCatalogResultsBeforeShowMoreV8();
  if (catalogVisibleLimit < CATALOG_INITIAL_VISIBLE_V8) {
    catalogVisibleLimit = CATALOG_INITIAL_VISIBLE_V8;
    updateCatalogResultsBeforeShowMoreV8();
  }
};

loadCatalog = async function loadCatalogResponsiveV8(...args) {
  const result = await loadCatalogBeforeShowMoreV8(...args);
  ensureCatalogVisibleBatchV8();
  if (currentView === "catalog") updateCatalogResults();
  return result;
};

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-catalog-show-more]");
  if (!button) return;
  event.preventDefault();
  if (catalogLoadPending) return;
  button.disabled = true;
  const original = button.innerHTML;
  button.textContent = catalogPageError ? "Повторяем…" : "Загружаем…";
  Promise.resolve(revealNextCatalogItem()).catch(() => {
    button.disabled = false;
    button.innerHTML = original;
  });
});

window.addEventListener("resize", () => {
  const button = document.querySelector("[data-catalog-show-more]");
  if (!button || currentView !== "catalog") return;
  const filtered = currentFilteredCatalog();
  const left = Math.max(0, catalogTotal - Math.min(catalogTotal, Math.min(catalogVisibleLimit, filtered.length)));
  const nextBatch = Math.min(catalogRevealBatchV8(), left);
  const counter = button.querySelector("span");
  if (counter && left > 0) counter.textContent = `${nextBatch} из ${left}`;
});

ensureCatalogVisibleBatchV8();
