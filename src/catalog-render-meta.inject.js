const renderCatalogViewBeforeMetadataV6 = renderCatalogView;
const updateCatalogResultsBeforeMetadataV6 = updateCatalogResults;
const loadCatalogBeforeMetadataV6 = loadCatalog;
let catalogCountRefreshQueuedV6 = false;

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

function refreshCatalogCountV6() {
  catalogCountRefreshQueuedV6 = false;
  if (currentView !== "catalog" || catalogLoading || catalogError) return;
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
  const result = await loadCatalogBeforeMetadataV6(...args);
  if (currentView === "catalog") {
    refreshCatalogCountV6();
    requestAnimationFrame(refreshCatalogCountV6);
  }
  return result;
};

new MutationObserver(scheduleCatalogCountRefreshV6).observe(app, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleCatalogCountRefreshV6);
scheduleCatalogCountRefreshV6();
