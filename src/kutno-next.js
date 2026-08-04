import { installGlobalTelemetry, kutnoApi } from "./kutno-api.js";
import { kutnoStore, normalizeIngredientName } from "./kutno-store.js";

installGlobalTelemetry();

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bridge() {
  return window.kutnoBridge || null;
}

function recipeId(recipe) {
  return bridge()?.getRecipeId?.(recipe) || String(recipe?.id || recipe?.title || "");
}

function pantryLabel(item) {
  const parts = [];
  if (item?.quantity != null && item?.unit) parts.push(`${String(item.quantity).replace(".", ",")} ${item.unit}`);
  if (item?.useBy) {
    const days = Math.ceil((new Date(`${item.useBy}T23:59:59`).getTime() - Date.now()) / 86_400_000);
    parts.push(days <= 0 ? "сегодня" : days === 1 ? "завтра" : days <= 3 ? `ещё ${days} дн.` : new Date(`${item.useBy}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }));
  }
  if (item?.opened) parts.push("открыто");
  return parts.join(" · ");
}

function ensurePantryDialog() {
  let dialog = document.querySelector("#kutno-pantry-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "kutno-pantry-dialog";
  dialog.className = "kutno-next-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="kutno-next-panel" data-pantry-form>
      <header>
        <div><p>Кутно / запасы</p><h2>Сколько продуктов осталось</h2></div>
        <button type="button" data-close-pantry aria-label="Закрыть">×</button>
      </header>
      <p class="kutno-next-intro">Количество помогает не предлагать блюдо на четыре яйца, когда осталось одно. Срок поднимает рецепты, которые лучше приготовить раньше.</p>
      <div class="kutno-pantry-rows" data-pantry-rows></div>
      <footer>
        <button type="button" data-close-pantry>Отмена</button>
        <button class="primary" type="submit">Сохранить запасы</button>
      </footer>
    </form>`;
  document.body.append(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-close-pantry]")) dialog.close();
  });
  dialog.querySelector("[data-pantry-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const next = {};
    dialog.querySelectorAll("[data-pantry-row]").forEach((row) => {
      const name = row.dataset.pantryName;
      const quantityValue = row.querySelector("[name='quantity']").value.trim();
      next[normalizeIngredientName(name)] = {
        name,
        quantity: quantityValue === "" ? null : Number(quantityValue.replace(",", ".")),
        unit: row.querySelector("[name='unit']").value,
        useBy: row.querySelector("[name='useBy']").value,
        opened: row.querySelector("[name='opened']").checked,
        updatedAt: Date.now(),
      };
    });
    kutnoStore.setPantry(next);
    const kitchen = bridge()?.getKitchenState?.() || {};
    const urgent = kutnoStore.urgentIngredients(2).map((item) => normalizeIngredientName(item.name));
    const priorities = [...urgent, ...(kitchen.priorityIngredients || [])].filter((item, index, list) => list.indexOf(item) === index).slice(0, 3);
    bridge()?.setPriorityIngredients?.(priorities);
    kutnoApi.telemetry("pantry_saved", { items: Object.keys(next).length, urgent: urgent.length });
    dialog.close();
    processUi();
  });
  return dialog;
}

function openPantryDialog() {
  const ingredients = bridge()?.getKitchenState?.().ingredients || [];
  if (!ingredients.length) return;
  kutnoStore.removeMissingIngredients(ingredients);
  const dialog = ensurePantryDialog();
  const rows = dialog.querySelector("[data-pantry-rows]");
  rows.innerHTML = ingredients.map((name) => {
    const item = kutnoStore.pantry[normalizeIngredientName(name)] || { name, quantity: null, unit: "", useBy: "", opened: false };
    return `<section class="kutno-pantry-row" data-pantry-row data-pantry-name="${escapeHtml(name)}">
      <strong>${escapeHtml(name)}</strong>
      <label><span>Осталось</span><input name="quantity" inputmode="decimal" value="${item.quantity ?? ""}" placeholder="не знаю"></label>
      <label><span>Единица</span><select name="unit">
        ${["", "г", "кг", "мл", "л", "шт.", "уп.", "банка"].map((unit) => `<option value="${unit}" ${item.unit === unit ? "selected" : ""}>${unit || "не указана"}</option>`).join("")}
      </select></label>
      <label><span>Использовать до</span><input name="useBy" type="date" value="${escapeHtml(item.useBy || "")}"></label>
      <label class="kutno-opened"><input name="opened" type="checkbox" ${item.opened ? "checked" : ""}><span>Упаковка открыта</span></label>
    </section>`;
  }).join("");
  dialog.showModal();
  kutnoApi.telemetry("pantry_opened", { items: ingredients.length });
}

function ensurePantryButton() {
  const selected = document.querySelector(".selected-ingredients");
  if (!selected || document.querySelector("[data-open-pantry]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pantry-details-button";
  button.dataset.openPantry = "";
  button.textContent = "Уточнить запасы";
  button.disabled = !(bridge()?.getKitchenState?.().ingredients || []).length;
  const actions = selected.parentElement?.querySelector(".ingredient-list-actions");
  (actions || selected).insertAdjacentElement("afterend", button);
}

function decorateIngredientTags() {
  document.querySelectorAll("[data-remove-ingredient]").forEach((tag) => {
    const item = kutnoStore.pantry[normalizeIngredientName(tag.dataset.removeIngredient)];
    const label = pantryLabel(item);
    let meta = tag.querySelector(".pantry-tag-meta");
    if (!label) {
      meta?.remove();
      return;
    }
    if (!meta) {
      meta = document.createElement("small");
      meta.className = "pantry-tag-meta";
      tag.append(meta);
    }
    meta.textContent = label;
  });
}

function currentRecipeFromSheet() {
  return bridge()?.getCurrentRecipe?.()?.recipe || null;
}

function renderAssessment() {
  const sheet = document.querySelector(".recipe-sheet");
  const recipe = currentRecipeFromSheet();
  if (!sheet || !recipe) return;
  const id = recipeId(recipe);
  let block = sheet.querySelector("[data-pantry-assessment]");
  if (block?.dataset.recipeId === id) return;
  block?.remove();
  const assessment = kutnoStore.quantityAssessment(recipe);
  const urgent = kutnoStore.urgentIngredients(3).filter((item) => (recipe.ingredients || []).some((ingredient) => {
    const candidate = normalizeIngredientName(ingredient.name);
    const owned = normalizeIngredientName(item.name);
    return candidate === owned || candidate.includes(owned) || owned.includes(candidate);
  }));
  if (!assessment.low.length && !assessment.enough.length && !urgent.length) return;
  block = document.createElement("section");
  block.className = `pantry-assessment ${assessment.low.length ? "has-shortage" : ""}`;
  block.dataset.pantryAssessment = "";
  block.dataset.recipeId = id;
  block.innerHTML = `
    <strong>${assessment.low.length ? "Проверьте количество" : "По запасам всё выглядит хорошо"}</strong>
    ${assessment.low.length ? `<p>Может не хватить: ${assessment.low.map((item) => `${escapeHtml(item.name)} — есть ${escapeHtml(pantryLabel(item.have).split(" · ")[0])}, нужно ${escapeHtml(item.need)}`).join("; ")}.</p>` : ""}
    ${urgent.length ? `<p>Лучше использовать раньше: ${urgent.map((item) => escapeHtml(item.name)).join(", ")}.</p>` : ""}`;
  const anchor = sheet.querySelector(".sheet-grid, .kf-ingredient-actions, .sheet-meta");
  anchor?.insertAdjacentElement(anchor.classList.contains("sheet-meta") ? "afterend" : "beforebegin", block);
}

function feedbackMarkup(recipe, compact = false) {
  const id = recipeId(recipe);
  return `<section class="recipe-feedback ${compact ? "compact" : ""}" data-recipe-feedback data-recipe-id="${escapeHtml(id)}">
    <p>${compact ? "Не подходит?" : "Помогите Кутно понять ваш выбор"}</p>
    <div>
      <button type="button" data-feedback-reason="dislike-ingredient">Не люблю продукт</button>
      <button type="button" data-feedback-reason="too-long">Долго</button>
      <button type="button" data-feedback-reason="too-hard">Сложно</button>
      <button type="button" data-feedback-reason="not-today">Не сегодня</button>
      <button type="button" data-feedback-reason="more-like-this">Похожее чаще</button>
    </div>
    <div class="feedback-ingredients" data-feedback-ingredients hidden></div>
  </section>`;
}

function ensureRecipeFeedback() {
  const sheet = document.querySelector(".recipe-sheet");
  const recipe = currentRecipeFromSheet();
  if (!sheet || !recipe || sheet.querySelector("[data-recipe-feedback]")) return;
  sheet.insertAdjacentHTML("beforeend", feedbackMarkup(recipe));
}

function swipeRecipe() {
  const card = document.querySelector(".swipe-card.front");
  if (!card) return null;
  const title = card.querySelector("h2, h3, .swipe-title")?.textContent?.trim();
  if (!title) return null;
  return (bridge()?.getCatalogRecipes?.() || []).find((recipe) => normalizeIngredientName(recipe.title) === normalizeIngredientName(title)) || null;
}

function ensureSwipeFeedback() {
  const page = document.querySelector(".swipe-page");
  const recipe = swipeRecipe();
  if (!page || !recipe) return;
  const existing = page.querySelector("[data-swipe-feedback]");
  const id = recipeId(recipe);
  if (existing?.dataset.recipeId === id) return;
  existing?.remove();
  const wrapper = document.createElement("div");
  wrapper.dataset.swipeFeedback = "";
  wrapper.dataset.recipeId = id;
  wrapper.innerHTML = feedbackMarkup(recipe, true);
  page.append(wrapper);
}

function recipeForFeedback(container) {
  const id = container.closest("[data-recipe-feedback]")?.dataset.recipeId || "";
  return currentRecipeFromSheet()
    || (bridge()?.getCatalogRecipes?.() || []).find((recipe) => recipeId(recipe) === id)
    || swipeRecipe();
}

function saveFeedback(recipe, reason, ingredient = "") {
  if (!recipe) return;
  kutnoStore.addFeedback({
    recipeId: recipeId(recipe),
    title: recipe.title,
    reason,
    ingredient,
    minutes: recipe.minutes,
    difficulty: recipe.difficulty,
  });
  bridge()?.rerankCatalog?.();
  kutnoApi.telemetry("recipe_feedback", { reason, ingredient: ingredient || undefined, recipeId: recipeId(recipe) });
  showToast(reason === "more-like-this" ? "Будем чаще показывать похожее" : "Учли — подбор станет точнее");
}

function showToast(message) {
  let toast = document.querySelector(".kutno-next-toast");
  if (!toast) {
    toast = document.createElement("output");
    toast.className = "kutno-next-toast";
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function processUi() {
  ensurePantryButton();
  decorateIngredientTags();
  renderAssessment();
  ensureRecipeFeedback();
  ensureSwipeFeedback();
}

function syncUrgentPriorities() {
  const kitchen = bridge()?.getKitchenState?.();
  if (!kitchen) return;
  kutnoStore.removeMissingIngredients(kitchen.ingredients || []);
  const urgent = kutnoStore.urgentIngredients(2).map((item) => normalizeIngredientName(item.name));
  if (!urgent.length) return;
  const priorities = [...urgent, ...(kitchen.priorityIngredients || [])].filter((item, index, list) => list.indexOf(item) === index).slice(0, 3);
  bridge()?.setPriorityIngredients?.(priorities, { render: false });
}

function startRemoteSync() {
  const check = () => {
    const user = bridge()?.getAuthUser?.();
    if (user?.id) kutnoStore.loadRemote(user.id);
  };
  check();
  window.setInterval(check, 5000);
}

window.kutnoPreferencePenalty = (recipe) => kutnoStore.preferencePenalty(recipe);
window.kutnoExpiryBoost = (recipe) => kutnoStore.expiryBoost(recipe);

function start() {
  syncUrgentPriorities();
  processUi();
  startRemoteSync();
  const observer = new MutationObserver(() => requestAnimationFrame(processUi));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  kutnoStore.addEventListener("change", () => {
    syncUrgentPriorities();
    processUi();
    bridge()?.rerankCatalog?.();
  });
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.matches("[data-open-pantry]")) openPantryDialog();
    if (target.matches('[aria-label="Пропустить рецепт"]')) window.kutnoLoadNextCatalogPage?.();
    const reason = target.dataset.feedbackReason;
    if (!reason) return;
    const block = target.closest("[data-recipe-feedback]");
    const recipe = recipeForFeedback(block);
    if (!recipe) return;
    if (reason !== "dislike-ingredient") {
      saveFeedback(recipe, reason);
      return;
    }
    const chooser = block.querySelector("[data-feedback-ingredients]");
    chooser.hidden = false;
    chooser.innerHTML = (recipe.ingredients || []).filter((item) => !item.pantry).slice(0, 10)
      .map((item) => `<button type="button" data-feedback-ingredient="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join("") || "<span>В рецепте нет отдельного продукта для выбора</span>";
  });
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-feedback-ingredient]");
    if (!target) return;
    const block = target.closest("[data-recipe-feedback]");
    const recipe = recipeForFeedback(block);
    saveFeedback(recipe, "dislike-ingredient", target.dataset.feedbackIngredient);
    block.querySelector("[data-feedback-ingredients]").hidden = true;
  });
}

if (bridge()) start();
else window.addEventListener("kutno:bridge-ready", start, { once: true });
