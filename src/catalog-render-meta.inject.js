const renderCatalogViewBeforeMetadataV6 = renderCatalogView;

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

renderCatalogView = function renderCatalogViewWithMetadataV6() {
  const markup = renderCatalogViewBeforeMetadataV6();
  if (catalogLoading || catalogError || !markup.includes('class="catalog-count"')) return markup;
  return markup.replace(
    /<div class="catalog-count">[\s\S]*?<\/div>/,
    `<div class="catalog-count">${catalogCountHtmlV6()}</div>`,
  );
};
