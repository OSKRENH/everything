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

const CATALOG_VISIBLE_BATCH_V7 = 12;
const updateCatalogResultsBeforeShowMoreV7 = updateCatalogResults;
const loadCatalogBeforeShowMoreV7 = loadCatalog;

function ensureCatalogVisibleBatchV7() {
  if (catalogVisibleLimit < CATALOG_VISIBLE_BATCH_V7) catalogVisibleLimit = CATALOG_VISIBLE_BATCH_V7;
}

requestCatalogPage = async function requestCatalogPageTwelveV7(cursor = "") {
  const portions = Math.max(1, Number(state.portions) || 2);
  const data = await kutnoApi.catalogPage({
    portions,
    limit: CATALOG_VISIBLE_BATCH_V7,
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

catalogScrollSentinel = function catalogShowMoreButtonV7(left) {
  const label = catalogPageError ? "Повторить загрузку" : "Показать ещё";
  const remaining = left > 0 ? `<span>${Math.min(CATALOG_VISIBLE_BATCH_V7, left)} из ${left}</span>` : "";
  return `<div class="catalog-scroll-sentinel catalog-show-more-wrap" data-catalog-scroll-sentinel><button class="catalog-show-more" type="button" data-catalog-show-more>${label}${remaining}</button></div>`;
};

sentinelIsNearViewport = function sentinelIsNearViewportManualV7() {
  return false;
};

armCatalogAutoLoad = function armCatalogManualLoadV7() {
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;
};

revealNextCatalogItem = async function revealNextCatalogBatchV7() {
  if (catalogLoadPending) return;
  catalogLoadPending = true;
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;

  const target = Math.max(CATALOG_VISIBLE_BATCH_V7, catalogVisibleLimit) + CATALOG_VISIBLE_BATCH_V7;
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

updateCatalogResults = function updateCatalogResultsTwelveV7() {
  ensureCatalogVisibleBatchV7();
  updateCatalogResultsBeforeShowMoreV7();
  if (catalogVisibleLimit < CATALOG_VISIBLE_BATCH_V7) {
    catalogVisibleLimit = CATALOG_VISIBLE_BATCH_V7;
    updateCatalogResultsBeforeShowMoreV7();
  }
};

loadCatalog = async function loadCatalogTwelveV7(...args) {
  const result = await loadCatalogBeforeShowMoreV7(...args);
  ensureCatalogVisibleBatchV7();
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

ensureCatalogVisibleBatchV7();
