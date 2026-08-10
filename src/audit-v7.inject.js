// V7 — продуктовая логика после полного аудита: одна форма с продуктами,
// три понятные группы результатов и техника как подсказка, а не фильтр.

function auditDisplayGroupsV7(items = []) {
  const now = [];
  const one = [];
  const almost = [];
  [...items]
    .sort((first, second) => matchingAnalysis(second).score - matchingAnalysis(first).score
      || Number(first?.minutes || 9999) - Number(second?.minutes || 9999))
    .forEach((recipe) => {
      const analysis = matchingAnalysis(recipe);
      if (["ready", "substitute"].includes(analysis.group)) now.push(recipe);
      else if (analysis.requiredMissing.length === 1) one.push(recipe);
      else if (analysis.requiredMissing.length >= 2 && analysis.requiredMissing.length <= 3) almost.push(recipe);
    });
  return { now, one, almost };
}

matchingContext = function auditMatchingContextV7() {
  return {
    ingredients: state.ingredients,
    priorityIngredients: state.priorityIngredients,
    equipment: [],
    baseIngredients: matchingBaseIngredients(),
  };
};

matchingSummary = function auditMatchingSummaryV7(items) {
  const groups = auditDisplayGroupsV7(items);
  return `<div class="matching-summary" aria-label="Результаты подбора">
    <span><b>${groups.now.length}</b> готовить сейчас</span>
    <span><b>${groups.one.length}</b> купить один продукт</span>
    <span><b>${groups.almost.length}</b> почти подходит</span>
  </div>`;
};

renderMatchingGroups = function auditRenderMatchingGroupsV7(items, cardRenderer, source = "catalog") {
  const groups = auditDisplayGroupsV7(items);
  const meta = {
    now: {
      title: "Готовьте сейчас",
      note: "Обязательные продукты уже есть. Необязательное можно пропустить или заменить.",
    },
    one: {
      title: "Купить один продукт",
      note: "До этих блюд не хватает ровно одного обязательного продукта.",
    },
    almost: {
      title: "Почти подходит",
      note: "Ближайшие варианты: не хватает двух–трёх продуктов.",
    },
  };
  return ["now", "one", "almost"].map((group) => {
    const recipesInGroup = groups[group];
    if (!recipesInGroup.length) return "";
    const info = meta[group];
    return `<section class="matching-group matching-group-${group}"><header><div><span>${String(recipesInGroup.length).padStart(2, "0")}</span><h3>${info.title}</h3></div><p>${info.note}</p></header><div class="matching-group-grid">${recipesInGroup.map((recipe) => cardRenderer(recipe, source === "catalog" ? catalogRecipes.indexOf(recipe) : recipes.indexOf(recipe), source)).join("")}</div></section>`;
  }).join("");
};

const auditResultsBeforeV7 = renderResults;
renderResults = function auditRenderResultsV7() {
  if (isLoading) return auditResultsBeforeV7();
  if (!recipes.length) {
    const suggestions = Array.isArray(kitchenUnlockSuggestionsV6) ? kitchenUnlockSuggestionsV6.slice(0, 4) : [];
    const suggestionMarkup = suggestions.length
      ? `<div class="matching-empty-suggestions"><p>Быстрее всего откроют новые блюда:</p><div class="quick-row">${suggestions.map((item) => `<button class="ingredient-tag smart-unlock-ingredient" data-add-ingredient="${escapeHtml(item.name)}">+ ${escapeHtml(item.name)} <small>· ${Number(item.count) || 1}</small></button>`).join("")}</div></div>`
      : "";
    if (generationError || state.ingredients.length) {
      return `<section class="generation-error matching-no-dead-end" id="results" aria-live="polite"><span>Ближайших вариантов пока нет</span><p>${escapeHtml(generationError || "Добавьте ещё один продукт — Кутно сразу пересчитает варианты.")}</p>${suggestionMarkup}<button data-action="generate">Проверить ещё раз</button></section>`;
    }
    return `<section class="manifesto-strip" aria-label="Как работает Кутно"><div><b>01</b><span>Запишите продукты</span></div><div><b>02</b><span>Посмотрите ближайшие блюда</span></div><div><b>03</b><span>Выберите рецепт</span></div></section>`;
  }
  return `<section class="results-section matching-results" id="results" aria-labelledby="results-title">
    <div class="results-heading"><span>Меню / ${recipes.length.toString().padStart(2, "0")}</span><h2 id="results-title">Что реально<br>приготовить</h2><p>Сначала — то, что можно готовить сейчас. Ниже — блюда с одной покупкой и самые близкие варианты.</p>${matchingSummary(recipes)}</div>
    <div class="recipe-list matching-recipe-list">${renderMatchingGroups(recipes, renderRecipeCard, "recipes")}${hasMoreRecipes || isLoadingMore ? `<button class="load-more-recipes" data-action="load-more" ${isLoadingMore ? "disabled" : ""}><span>${isLoadingMore ? "Загружаем" : "Загрузить ещё"}</span>${isLoadingMore ? renderPotLoader("pot-loader-small") : `<span aria-hidden="true">↓</span>`}</button>` : ""}</div>
  </section>`;
};

function stripEquipmentSectionV7(markup) {
  return String(markup).replace(
    /<section class="form-section">\s*<div class="section-index">02<\/div>[\s\S]*?<span class="field-label">Что умеет кухня<\/span>[\s\S]*?<\/section>/,
    "",
  );
}

const auditKitchenBeforeV7 = renderKitchenView;
renderKitchenView = function auditKitchenViewV7() {
  state.equipment = [];
  return stripEquipmentSectionV7(auditKitchenBeforeV7())
    .replace("с учётом доступной техники и выбранного типа блюда.", "с учётом ваших продуктов и выбранного типа блюда.");
};

function pruneEquipmentSectionV7(root = app) {
  root?.querySelectorAll?.(".equipment-grid").forEach((grid) => grid.closest(".form-section")?.remove());
}

ensureMatchingBaseDialog = function auditBaseDialogV7() {
  if (document.querySelector(".matching-base-dialog")) return;
  const selected = new Set(matchingBaseIngredients().map(semanticNormalizeIngredient));
  const options = [
    "соль",
    "вода",
    "растительное масло",
    "сахар",
    "пшеничная мука",
    "чёрный перец",
    "уксус",
  ];
  const wrapper = document.createElement("div");
  wrapper.className = "matching-base-dialog";
  wrapper.hidden = true;
  wrapper.innerHTML = `<button class="matching-dialog-backdrop" data-matching-action="close-base-products" aria-label="Закрыть"></button><section role="dialog" aria-modal="true" aria-labelledby="matching-base-title"><header><div><p>Настройка кухни</p><h2 id="matching-base-title">Что обычно есть дома?</h2></div><button data-matching-action="close-base-products">Закрыть ×</button></header><p class="microcopy">Отметьте один раз — эти продукты больше не придётся вводить вручную.</p><div class="matching-base-options">${options.map((item) => `<label><input type="checkbox" value="${escapeHtml(item)}" ${selected.has(semanticNormalizeIngredient(item)) ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("")}</div><button class="matching-base-save" data-matching-action="save-base-products">Сохранить</button></section>`;
  document.body.append(wrapper);
};

state.equipment = [];
pruneEquipmentSectionV7();
new MutationObserver(() => pruneEquipmentSectionV7()).observe(app, { childList: true, subtree: true });
