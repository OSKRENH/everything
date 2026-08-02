const matchingBaseIngredientsBeforeRussiaDefaults = matchingBaseIngredients;

function sameNormalizedBaseSet(values, expected) {
  const normalized = values.map(semanticNormalizeIngredient).sort();
  const target = expected.map(semanticNormalizeIngredient).sort();
  return normalized.length === target.length && normalized.every((item, index) => item === target[index]);
}

matchingBaseIngredients = function russianBaseIngredients() {
  const values = matchingBaseIngredientsBeforeRussiaDefaults()
    .filter((item) => !semanticNormalizeIngredient(item).includes("оливков"));
  const isPreviousDefault = [
    ["соль", "вода", "растительное масло"],
    ["соль", "вода", "растительное масло", "чёрный перец"],
  ].some((preset) => sameNormalizedBaseSet(values, preset));
  const next = isPreviousDefault || !values.length
    ? [...SEMANTIC_DEFAULT_BASE_INGREDIENTS]
    : values;
  try {
    const stored = JSON.parse(localStorage.getItem(MATCHING_BASE_KEY));
    if (!Array.isArray(stored) || JSON.stringify(stored) !== JSON.stringify(next)) {
      localStorage.setItem(MATCHING_BASE_KEY, JSON.stringify(next));
    }
  } catch {
    localStorage.setItem(MATCHING_BASE_KEY, JSON.stringify(next));
  }
  return next;
};

const ensureMatchingBaseDialogBeforeRussiaDefaults = ensureMatchingBaseDialog;
ensureMatchingBaseDialog = function russianBaseDialog() {
  ensureMatchingBaseDialogBeforeRussiaDefaults();
  const options = document.querySelector(".matching-base-options");
  if (!options) return;

  [...options.querySelectorAll("label")].forEach((label) => {
    const value = label.querySelector("input")?.value || "";
    if (semanticNormalizeIngredient(value).includes("оливков")) label.remove();
  });

  const selected = new Set(matchingBaseIngredients().map(semanticNormalizeIngredient));
  ["чёрный перец", "пшеничная мука"].forEach((item) => {
    const exists = [...options.querySelectorAll("input")]
      .some((input) => semanticNormalizeIngredient(input.value) === semanticNormalizeIngredient(item));
    if (exists) return;
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(item)}" ${selected.has(semanticNormalizeIngredient(item)) ? "checked" : ""}><span>${escapeHtml(item)}</span>`;
    options.append(label);
  });
};

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

function matchingRequestMeta(input, init = {}) {
  let method = String(init.method || "GET").toUpperCase();
  let pathname = "";
  try {
    if (typeof Request !== "undefined" && input instanceof Request) {
      method = String(init.method || input.method || "GET").toUpperCase();
      pathname = new URL(input.url, location.origin).pathname;
    } else {
      const raw = typeof input === "string"
        ? input
        : typeof URL !== "undefined" && input instanceof URL
          ? input.href
          : String(input?.url || "");
      pathname = raw ? new URL(raw, location.origin).pathname : "";
    }
  } catch {
    pathname = "";
  }
  return { method, pathname };
}

const matchingFetchWithRefresh = window.fetch.bind(window);
window.fetch = async function matchingRefreshFetch(input, init = {}) {
  const response = await matchingFetchWithRefresh(input, init);
  const { pathname, method } = matchingRequestMeta(input, init);
  if (pathname === "/api/generate" && method === "POST") {
    response.clone().json().then((data) => {
      matchingRelaxation = data?.relaxation || null;
      if (data?.recipes?.length) requestAnimationFrame(() => {
        if (currentView === "kitchen" && recipes.length) renderKitchenResults();
      });
    }).catch(() => {});
  }
  return response;
};

ensureMatchingBaseDialog();
ensureManualEquipmentNote();
if (currentView === "kitchen") renderMainView();
new MutationObserver(() => requestAnimationFrame(() => {
  ensureMatchingBaseDialog();
  ensureManualEquipmentNote();
}))
  .observe(document.documentElement, { childList: true, subtree: true });
