let kitchenUnlockSuggestionsV6 = [];
let kitchenUnlockRequestV6 = 0;
let kitchenUnlockTimerV6 = 0;

function renderKitchenUnlockSuggestionsV6() {
  const row = app?.querySelector?.(".quick-row");
  if (!row || !state.ingredients.length || !kitchenUnlockSuggestionsV6.length) return;
  row.dataset.smartSuggestions = "true";
  row.setAttribute("aria-label", "Продукты, которые откроют больше рецептов");
  row.innerHTML = kitchenUnlockSuggestionsV6.map((item) => `
    <button class="ingredient-tag smart-unlock-ingredient" data-add-ingredient="${escapeHtml(item.name)}">
      + ${escapeHtml(item.name)} <small>· ${Number(item.count) || 1} ${Number(item.count) === 1 ? "блюдо" : "блюд"}</small>
    </button>`).join("");
}

async function refreshKitchenUnlockSuggestionsV6() {
  window.clearTimeout(kitchenUnlockTimerV6);
  kitchenUnlockTimerV6 = 0;
  const requestId = ++kitchenUnlockRequestV6;
  if (!state.ingredients.length) {
    kitchenUnlockSuggestionsV6 = [];
    return;
  }
  try {
    const data = await kutnoApi.matchingSuggestions({
      ingredients: state.ingredients,
      equipment: state.equipment.map(equipmentName),
      baseIngredients: matchingBaseIngredients(),
    });
    if (requestId !== kitchenUnlockRequestV6) return;
    kitchenUnlockSuggestionsV6 = Array.isArray(data?.suggestions)
      ? data.suggestions.filter((item) => item?.name && !state.ingredients.some((owned) => ingredientMatches(owned, item.name))).slice(0, 6)
      : [];
    renderKitchenUnlockSuggestionsV6();
  } catch {
    // Обычные быстрые продукты остаются доступными без этого необязательного запроса.
  }
}

function scheduleKitchenUnlockSuggestionsV6(delay = 120) {
  window.clearTimeout(kitchenUnlockTimerV6);
  kitchenUnlockTimerV6 = window.setTimeout(refreshKitchenUnlockSuggestionsV6, delay);
}

const renderKitchenViewBeforeUnlockSuggestionsV6 = renderKitchenView;
renderKitchenView = function renderKitchenWithUnlockSuggestionsV6() {
  const markup = renderKitchenViewBeforeUnlockSuggestionsV6();
  queueMicrotask(renderKitchenUnlockSuggestionsV6);
  return markup;
};

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (
    target.dataset.addIngredient !== undefined
    || target.dataset.removeIngredient !== undefined
    || target.dataset.equipment !== undefined
    || target.dataset.action === "confirm-clear-products"
  ) scheduleKitchenUnlockSuggestionsV6();
});

app.addEventListener("submit", (event) => {
  if (event.target.id === "ingredient-form") scheduleKitchenUnlockSuggestionsV6();
});

window.addEventListener("kutno:bridge-ready", () => scheduleKitchenUnlockSuggestionsV6(40), { once: true });
if (state.ingredients.length) scheduleKitchenUnlockSuggestionsV6(80);
