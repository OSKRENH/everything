const matchingEnhancedUpdateCatalogResults = updateCatalogResults;
updateCatalogResults = function stableMatchingCatalogResults() {
  const count = document.querySelector(".catalog-count");
  const grid = document.querySelector(".catalog-grid");
  if (!count || !grid) return;
  if (state.ingredients.length) {
    matchingEnhancedUpdateCatalogResults();
    return;
  }
  const filtered = orderCatalogRecipes(filteredCatalogRecipes());
  count.textContent = `Найдено — ${filtered.length.toString().padStart(2, "0")}`;
  const signature = `plain:${filtered.map((recipe) => recipeId(recipe)).join("|")}`;
  if (grid.dataset.matchingSignature === signature) return;
  grid.dataset.matchingSignature = signature;
  grid.innerHTML = filtered.length
    ? filtered.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("")
    : `<p class="catalog-empty">Ничего не нашлось. Попробуйте убрать один из фильтров.</p>`;
};

function ensureManualEquipmentNote() {
  const label = [...document.querySelectorAll(".field-label")]
    .find((node) => node.textContent?.trim() === "Что умеет кухня");
  const content = label?.closest(".section-content");
  const equipmentGrid = content?.querySelector(".equipment-grid");
  if (!equipmentGrid || content.querySelector(".manual-equipment-note")) return;
  const note = document.createElement("p");
  note.className = "manual-equipment-note";
  note.textContent = "Нож, руки, доска, миска и столовые приборы доступны всегда. Если ничего не отмечено, Кутно предложит салаты, сэндвичи и другие холодные блюда.";
  equipmentGrid.insertAdjacentElement("afterend", note);
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-matching-action]")?.dataset.matchingAction;
  if (action !== "save-base-products") return;
  window.setTimeout(() => {
    if (["catalog", "swipe"].includes(currentView)) loadCatalog(true);
    else renderMainView();
  }, 0);
}, false);

const matchingFetchWithRefresh = window.fetch.bind(window);
window.fetch = async function matchingRefreshFetch(input, init = {}) {
  const response = await matchingFetchWithRefresh(input, init);
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
  const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (url.pathname === "/api/generate" && method === "POST") {
    response.clone().json().then((data) => {
      matchingRelaxation = data?.relaxation || null;
      if (data?.recipes?.length) requestAnimationFrame(() => {
        if (currentView === "kitchen" && recipes.length) renderKitchenResults();
      });
    }).catch(() => {});
  }
  return response;
};

ensureManualEquipmentNote();
new MutationObserver(() => requestAnimationFrame(ensureManualEquipmentNote))
  .observe(document.documentElement, { childList: true, subtree: true });
