let swipeFullCatalogLoading = false;
let swipeFullCatalogPromise = null;

function swipeCatalogIsComplete() {
  if (!catalogRecipes.length) return false;
  if (catalogUsingFallback) return true;
  if (catalogNextCursor) return false;
  return !catalogTotal || catalogRecipes.length >= catalogTotal;
}

function renderSwipeFullCatalogLoader() {
  const loaded = catalogRecipes.length;
  const total = Math.max(catalogTotal, loaded);
  const progress = total > loaded ? `Загружено ${loaded} из ${total}` : "Собираем полную колоду";
  return `<section class="swipe-page"><div class="swipe-heading"><p class="eyebrow">Выбирать можно быстрее</p><h1>АМ <span class="am-heart">❤️</span></h1><p>${progress}. Продукты и настройки кухни здесь не ограничивают выбор.</p>${renderPotLoader("pot-loader-large")}</div></section>`;
}

const renderSwipeViewBeforeFullCatalog = renderSwipeView;
renderSwipeView = function renderSwipeViewWithFullCatalog() {
  if (swipeFullCatalogLoading) return renderSwipeFullCatalogLoader();
  return renderSwipeViewBeforeFullCatalog();
};

async function waitForCurrentCatalogRequest() {
  let attempts = 0;
  while (catalogLoading && attempts < 300) {
    await catalogDelay(50);
    attempts += 1;
  }
}

async function hydrateFullSwipeCatalog() {
  if (swipeFullCatalogPromise) return swipeFullCatalogPromise;
  swipeFullCatalogLoading = true;
  if (currentView === "swipe") renderMainView({ preserveScroll: false });

  swipeFullCatalogPromise = (async () => {
    await waitForCurrentCatalogRequest();

    if (!catalogRecipes.length && !catalogLoading) await loadCatalog();
    await waitForCurrentCatalogRequest();

    const maximumPages = Math.max(1, Math.ceil(Math.max(catalogTotal, catalogRecipes.length, CATALOG_PAGE_SIZE) / CATALOG_PAGE_SIZE) + 2);
    let pages = 0;
    while (catalogNextCursor && !catalogUsingFallback && pages < maximumPages) {
      const previousCursor = catalogNextCursor;
      const result = await loadNextCatalogPage();
      if (!result.loaded || catalogNextCursor === previousCursor) break;
      pages += 1;
      if (currentView === "swipe") renderMainView({ preserveScroll: false });
    }

    resetSwipeDeck();
    kutnoApi.telemetry("swipe_catalog_ready", {
      loaded: catalogRecipes.length,
      total: Math.max(catalogTotal, catalogRecipes.length),
      complete: swipeCatalogIsComplete(),
    }, "debug");
    return swipeCatalogIsComplete();
  })().finally(() => {
    swipeFullCatalogLoading = false;
    swipeFullCatalogPromise = null;
    if (currentView === "swipe") renderMainView({ preserveScroll: false });
  });

  return swipeFullCatalogPromise;
}

const setViewBeforeFullSwipeCatalog = setView;
setView = function setViewWithFullSwipeCatalog(view) {
  if (view === "swipe") swipeFullCatalogLoading = !swipeCatalogIsComplete();
  setViewBeforeFullSwipeCatalog(view);
  if (view === "swipe" && !swipeCatalogIsComplete()) void hydrateFullSwipeCatalog();
};

if (currentView === "swipe") {
  swipeFullCatalogLoading = !swipeCatalogIsComplete();
  queueMicrotask(() => void hydrateFullSwipeCatalog());
}
