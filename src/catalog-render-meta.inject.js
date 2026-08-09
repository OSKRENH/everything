const renderCatalogViewBeforeMetadataV6 = renderCatalogView;
const updateCatalogResultsBeforeMetadataV6 = updateCatalogResults;
const loadCatalogBeforeMetadataV6 = loadCatalog;
const requestCatalogPageBeforeMetadataV6 = requestCatalogPage;
let catalogCountRefreshQueuedV6 = false;
let catalogMetadataRecoveryAttemptedV6 = false;

function catalogCountHtmlV6() {
  const filtered = currentFilteredCatalog();
  const total = knownCatalogTotal();
  if (catalogAvailability !== "все") {
    return `Показано — ${filtered.length.toString().padStart(2, "0")} из ${total.toString().padStart(2, "0")}${state.ingredients.length ? matchingSummary(filtered) : ""}`;
  }
  const exactTotal = catalogStaticTotal();
  const label = catalogHasStaticFilters() ? "Найдено" : "В базе";
  return `${label} — ${exactTotal.toString().padStart(2, "0")}${state.ingredients.length ? matchingSummary(filtered) : ""}`;
}

requestCatalogPage = async function requestCatalogPageWithMetadataV6(...args) {
  const page = await requestCatalogPageBeforeMetadataV6(...args);
  const total = Number(page?.total) || 0;
  if (total > 0) {
    catalogTotal = Math.max(catalogTotal, total);
    catalogMetadataTotal = Math.max(catalogMetadataTotal, total);
  }
  return page;
};

function recoverCatalogMetadataV6() {
  if (catalogMetadataRecoveryAttemptedV6 || !catalogNextCursor) return;
  if (knownCatalogTotal() > catalogRecipes.length) return;
  catalogMetadataRecoveryAttemptedV6 = true;
  Promise.resolve(loadCatalogIndexInBackground()).finally(() => {
    if (currentView !== "catalog") return;
    refreshCatalogCountV6();
    requestAnimationFrame(refreshCatalogCountV6);
  });
}

function refreshCatalogCountV6() {
  catalogCountRefreshQueuedV6 = false;
  if (currentView !== "catalog" || catalogLoading || catalogError) return;
  recoverCatalogMetadataV6();
  const count = document.querySelector(".catalog-count");
  if (!count) return;
  const next = catalogCountHtmlV6();
  if (count.innerHTML !== next) count.innerHTML = next;
}

function scheduleCatalogCountRefreshV6() {
  if (catalogCountRefreshQueuedV6) return;
  catalogCountRefreshQueuedV6 = true;
  queueMicrotask(refreshCatalogCountV6);
}

renderCatalogView = function renderCatalogViewWithMetadataV6() {
  const markup = renderCatalogViewBeforeMetadataV6();
  if (catalogLoading || catalogError || !markup.includes('class="catalog-count"')) return markup;
  return markup.replace(
    /<div class="catalog-count">[\s\S]*?<\/div>/,
    `<div class="catalog-count">${catalogCountHtmlV6()}</div>`,
  );
};

updateCatalogResults = function updateCatalogResultsWithMetadataV6() {
  updateCatalogResultsBeforeMetadataV6();
  refreshCatalogCountV6();
};

loadCatalog = async function loadCatalogWithMetadataRefreshV6(...args) {
  catalogMetadataRecoveryAttemptedV6 = false;
  const result = await loadCatalogBeforeMetadataV6(...args);
  if (currentView === "catalog") {
    refreshCatalogCountV6();
    requestAnimationFrame(refreshCatalogCountV6);
  }
  return result;
};

armCatalogAutoLoad = function armCatalogAutoLoadAfterFirstScrollV6() {
  catalogLoadObserver?.disconnect();
  catalogLoadObserver = null;
  const sentinel = document.querySelector("[data-catalog-scroll-sentinel]");
  if (!sentinel || catalogLoadPending) return;
  if (typeof IntersectionObserver === "undefined") return;
  catalogLoadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    // До первого реального скролла сохраняем быстрый первый экран из пяти карточек.
    // После него продолжаем раскрывать карточки, пока sentinel остаётся у края экрана:
    // Chromium не обязан генерировать новый scroll event для уже видимого элемента.
    if (catalogScrollVersion === 0) return;
    revealNextCatalogItem();
  }, { rootMargin: "60px 0px" });
  catalogLoadObserver.observe(sentinel);
};

new MutationObserver(scheduleCatalogCountRefreshV6).observe(app, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleCatalogCountRefreshV6);
scheduleCatalogCountRefreshV6();
