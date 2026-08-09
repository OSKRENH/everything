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
