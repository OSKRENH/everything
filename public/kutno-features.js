(() => {
  "use strict";

  const KITCHEN_KEY = "kutno-kitchen-v2";
  const FAVORITES_KEY = "kutno-favorites-v1";
  const SWIPE_KEY = "kutno-swipe-history-v1";
  const SHOPPING_KEY = "kutno-shopping-v1";
  const PORTIONS_KEY = "kutno-recipe-portions-v1";
  const BASE_STAPLES = ["соль", "вода", "масло", "перец", "растительное масло", "оливковое масло"];

  let mutationQueued = false;
  let lastSwipeSnapshot = readArray(SWIPE_KEY);
  let lastFavoritesSnapshot = readArray(FAVORITES_KEY);
  let undoTimer = 0;
  let sharedRecipeAttempts = 0;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readArray(key) {
    const value = readJson(key, []);
    return Array.isArray(value) ? value : [];
  }

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("ru-RU")
      .replace(/ё/g, "е")
      .replace(/[«»“”"'()]/g, " ")
      .replace(/[^a-zа-я0-9\s-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function recipeTitle() {
    return document.querySelector("#recipe-title")?.textContent?.trim() || "Рецепт";
  }

  function currentKitchenIngredients() {
    const kitchen = readJson(KITCHEN_KEY, {});
    const ingredients = Array.isArray(kitchen?.ingredients) ? kitchen.ingredients : [];
    return ingredients.map(normalize).filter(Boolean);
  }

  function rowIngredientName(row) {
    return (
      row.querySelector(".ingredient-info-name")?.textContent ||
      row.querySelector(":scope > span")?.textContent ||
      row.querySelector("summary span")?.textContent ||
      ""
    ).trim();
  }

  function isStaple(name) {
    const normalized = normalize(name);
    return BASE_STAPLES.some((staple) => normalized.includes(normalize(staple)));
  }

  function kitchenHas(name, kitchenIngredients) {
    const target = normalize(name);
    if (!target || isStaple(target)) return true;
    return kitchenIngredients.some((item) => {
      if (!item) return false;
      return target === item || target.includes(item) || item.includes(target);
    });
  }

  function ingredientRows() {
    return [...document.querySelectorAll(".ingredient-ledger > li")];
  }

  function missingIngredients() {
    const kitchen = currentKitchenIngredients();
    return ingredientRows()
      .map((row) => ({
        name: rowIngredientName(row),
        amount: row.querySelector(":scope > b")?.textContent?.trim() || "",
      }))
      .filter((item) => item.name && !kitchenHas(item.name, kitchen));
  }

  function pluralPortions(value) {
    const n = Math.abs(Number(value) || 0) % 100;
    const last = n % 10;
    if (n > 10 && n < 20) return `${value} порций`;
    if (last === 1) return `${value} порция`;
    if (last >= 2 && last <= 4) return `${value} порции`;
    return `${value} порций`;
  }

  function parsePortionsFromMeta() {
    const span = [...document.querySelectorAll(".sheet-meta span")].find((item) => /порц/i.test(item.textContent || ""));
    const match = span?.textContent?.match(/\d+/);
    return Math.max(1, Number(match?.[0]) || 2);
  }

  function updatePortionsMeta(value) {
    const span = [...document.querySelectorAll(".sheet-meta span")].find((item) => /порц/i.test(item.textContent || ""));
    if (span) span.textContent = pluralPortions(value);
  }

  const UNICODE_FRACTIONS = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,
  };

  function parseAmount(text) {
    const source = String(text || "").trim();
    if (!source || /по вкусу|щепот|для жарки|сколько потребуется/i.test(source)) return null;
    const match = source.match(/^(\d+(?:[.,]\d+)?)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])?\s*(.*)$/u);
    if (!match || (!match[1] && !match[2])) return null;
    const number = Number(String(match[1] || 0).replace(",", "."));
    const fraction = UNICODE_FRACTIONS[match[2]] || 0;
    const value = number + fraction;
    if (!Number.isFinite(value) || value <= 0) return null;
    return { value, unit: String(match[3] || "").trim() };
  }

  function formatScaledAmount(baseText, factor) {
    const parsed = parseAmount(baseText);
    if (!parsed) return baseText;
    let value = parsed.value * factor;
    const unit = parsed.unit;
    if (/^(г|гр|мл)(?:\.|\s|$)/i.test(unit)) value = Math.max(5, Math.round(value / 5) * 5);
    else if (/шт/i.test(unit)) value = Math.max(1, Math.round(value));
    else value = Math.max(0.25, Math.round(value * 4) / 4);

    let display;
    const integer = Math.floor(value);
    const fraction = Math.round((value - integer) * 100) / 100;
    const fractionGlyph = fraction === 0.25 ? "¼" : fraction === 0.5 ? "½" : fraction === 0.75 ? "¾" : "";
    if (fractionGlyph) display = `${integer || ""}${fractionGlyph}`;
    else display = Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
    return `${display} ${unit}`.trim();
  }

  function portionPreferences() {
    const value = readJson(PORTIONS_KEY, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function setPortionPreference(title, portions) {
    const preferences = portionPreferences();
    preferences[normalize(title)] = portions;
    writeJson(PORTIONS_KEY, preferences);
  }

  function applyPortions(value) {
    const ledger = document.querySelector(".ingredient-ledger");
    if (!ledger) return;
    const basePortions = Math.max(1, Number(ledger.dataset.kfBasePortions) || parsePortionsFromMeta());
    const factor = value / basePortions;
    ingredientRows().forEach((row) => {
      const amount = row.querySelector(":scope > b");
      if (!amount) return;
      if (!amount.dataset.kfBaseAmount) amount.dataset.kfBaseAmount = amount.textContent.trim();
      amount.textContent = formatScaledAmount(amount.dataset.kfBaseAmount, factor);
    });
    ledger.dataset.kfCurrentPortions = String(value);
    const output = document.querySelector("[data-kf-portions-output]");
    if (output) output.textContent = pluralPortions(value);
    updatePortionsMeta(value);
    setPortionPreference(recipeTitle(), value);
    refreshMissingAction();
  }

  function shoppingItems() {
    return readArray(SHOPPING_KEY);
  }

  function saveShopping(items) {
    writeJson(SHOPPING_KEY, items.slice(0, 200));
    renderShopping();
  }

  function shoppingCount(items = shoppingItems()) {
    return items.filter((item) => !item.checked).length;
  }

  function addMissingToShopping() {
    const missing = missingIngredients();
    if (!missing.length) {
      showToast("Все продукты уже есть дома");
      return;
    }
    const title = recipeTitle();
    const items = shoppingItems();
    missing.forEach((ingredient) => {
      const id = normalize(ingredient.name);
      const existing = items.find((item) => item.id === id);
      if (existing) {
        existing.amount = ingredient.amount || existing.amount;
        existing.checked = false;
        existing.recipeTitle = title;
      } else {
        items.unshift({
          id,
          name: ingredient.name,
          amount: ingredient.amount,
          checked: false,
          recipeTitle: title,
          addedAt: Date.now(),
        });
      }
    });
    saveShopping(items);
    showToast(`Добавлено в покупки: ${missing.length}`);
  }

  function ensureShoppingUi() {
    if (!document.querySelector(".kf-shopping-fab")) {
      const fab = document.createElement("button");
      fab.type = "button";
      fab.className = "kf-shopping-fab";
      fab.dataset.kfAction = "open-shopping";
      fab.setAttribute("aria-label", "Открыть список покупок");
      document.body.append(fab);
    }
    if (!document.querySelector(".kf-shopping-drawer")) {
      const wrapper = document.createElement("div");
      wrapper.className = "kf-shopping-drawer";
      wrapper.hidden = true;
      wrapper.innerHTML = `
        <button class="kf-shopping-backdrop" data-kf-action="close-shopping" aria-label="Закрыть список покупок"></button>
        <section class="kf-shopping-panel" role="dialog" aria-modal="true" aria-labelledby="kf-shopping-title">
          <header>
            <div><p>Кутно / покупки</p><h2 id="kf-shopping-title">Список покупок</h2></div>
            <button type="button" data-kf-action="close-shopping">Закрыть ×</button>
          </header>
          <div class="kf-shopping-list" data-kf-shopping-list></div>
          <footer>
            <button type="button" data-kf-action="move-bought">Купленное → на кухню</button>
            <button type="button" data-kf-action="clear-bought">Убрать отмеченное</button>
          </footer>
        </section>`;
      document.body.append(wrapper);
    }
  }

  function renderShopping() {
    ensureShoppingUi();
    const items = shoppingItems();
    const count = shoppingCount(items);
    const fab = document.querySelector(".kf-shopping-fab");
    if (fab) {
      const nextHidden = items.length === 0;
      const nextLabel = `Покупки · ${count}`;
      if (fab.hidden !== nextHidden) fab.hidden = nextHidden;
      if (fab.textContent !== nextLabel) fab.textContent = nextLabel;
    }
    const list = document.querySelector("[data-kf-shopping-list]");
    if (!list) return;
    const signature = JSON.stringify(items);
    if (list.dataset.kfSignature === signature) return;
    list.dataset.kfSignature = signature;
    if (!items.length) {
      list.innerHTML = `<div class="kf-shopping-empty"><strong>Пока пусто</strong><p>Добавьте недостающие продукты из любого рецепта.</p></div>`;
      return;
    }
    list.innerHTML = items
      .map(
        (item) => `<label class="kf-shopping-item ${item.checked ? "checked" : ""}">
          <input type="checkbox" data-kf-shopping-id="${escapeAttr(item.id)}" ${item.checked ? "checked" : ""}>
          <span><strong>${escapeHtml(item.name)}</strong>${item.recipeTitle ? `<small>${escapeHtml(item.recipeTitle)}</small>` : ""}</span>
          <b>${escapeHtml(item.amount || "")}</b>
        </label>`,
      )
      .join("");
  }

  function openShopping() {
    ensureShoppingUi();
    renderShopping();
    const drawer = document.querySelector(".kf-shopping-drawer");
    if (!drawer) return;
    drawer.hidden = false;
    document.documentElement.classList.add("kf-shopping-open");
  }

  function closeShopping() {
    const drawer = document.querySelector(".kf-shopping-drawer");
    if (drawer) drawer.hidden = true;
    document.documentElement.classList.remove("kf-shopping-open");
  }

  function toggleShoppingItem(id, checked) {
    const items = shoppingItems();
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    item.checked = checked;
    saveShopping(items);
  }

  function clearBought() {
    const items = shoppingItems();
    const next = items.filter((item) => !item.checked);
    saveShopping(next);
  }

  function moveBoughtToKitchen() {
    const items = shoppingItems();
    const bought = items.filter((item) => item.checked);
    if (!bought.length) {
      showToast("Сначала отметьте купленные продукты");
      return;
    }
    const kitchen = readJson(KITCHEN_KEY, {});
    const current = Array.isArray(kitchen.ingredients) ? kitchen.ingredients : [];
    const normalizedCurrent = new Set(current.map(normalize));
    bought.forEach((item) => {
      if (!normalizedCurrent.has(normalize(item.name))) current.push(item.name);
    });
    kitchen.ingredients = current;
    writeJson(KITCHEN_KEY, kitchen);
    saveShopping(items.filter((item) => !item.checked));
    closeShopping();
    showToast("Купленное добавлено на кухню");
    window.setTimeout(() => location.reload(), 700);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function refreshMissingAction() {
    const button = document.querySelector("[data-kf-action='add-missing']");
    if (!button) return;
    const missing = missingIngredients();
    button.disabled = missing.length === 0;
    button.textContent = missing.length ? `В покупки · ${missing.length}` : "Все продукты дома";
  }

  function enhanceRecipeOverlay() {
    const sheet = document.querySelector(".recipe-sheet");
    const header = sheet?.querySelector(".sheet-header");
    const ledger = sheet?.querySelector(".ingredient-ledger");
    if (!sheet || !header || !ledger || sheet.dataset.kfEnhanced === "true") return;
    sheet.dataset.kfEnhanced = "true";

    const basePortions = parsePortionsFromMeta();
    ledger.dataset.kfBasePortions = String(basePortions);
    ingredientRows().forEach((row) => {
      const amount = row.querySelector(":scope > b");
      if (amount) amount.dataset.kfBaseAmount = amount.textContent.trim();
    });

    const tools = document.createElement("div");
    tools.className = "kf-recipe-tools";
    tools.innerHTML = `
      <div class="kf-portions" aria-label="Количество порций">
        <button type="button" data-kf-action="portion-down" aria-label="Уменьшить число порций">−</button>
        <output data-kf-portions-output>${pluralPortions(basePortions)}</output>
        <button type="button" data-kf-action="portion-up" aria-label="Увеличить число порций">+</button>
      </div>
      <button type="button" class="kf-share" data-kf-action="share">Поделиться</button>`;
    header.append(tools);

    const ingredientsSection = ledger.closest("section");
    if (ingredientsSection) {
      const actions = document.createElement("div");
      actions.className = "kf-ingredient-actions";
      actions.innerHTML = `
        <button type="button" data-kf-action="add-missing"></button>
        <button type="button" data-kf-action="open-shopping">Открыть покупки</button>`;
      ledger.before(actions);
    }

    const saved = Number(portionPreferences()[normalize(recipeTitle())]);
    applyPortions(saved >= 1 && saved <= 12 ? saved : basePortions);
    refreshMissingAction();
  }

  function currentPortions() {
    return Math.max(1, Number(document.querySelector(".ingredient-ledger")?.dataset.kfCurrentPortions) || parsePortionsFromMeta());
  }

  async function shareRecipe() {
    const title = recipeTitle();
    const url = new URL(location.href);
    url.hash = `recipe=${encodeURIComponent(title)}`;
    const data = { title: `${title} — Кутно`, text: `Рецепт «${title}» в Кутно`, url: url.toString() };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url.toString());
        showToast("Ссылка на рецепт скопирована");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Не удалось поделиться рецептом");
    }
  }

  function parsedSharedRecipe() {
    const match = location.hash.match(/^#recipe=(.+)$/);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function tryOpenSharedRecipe() {
    const title = parsedSharedRecipe();
    if (!title || document.querySelector("#recipe-title")) return;
    const catalogButton = document.querySelector('[data-view="catalog"]');
    if (catalogButton && !catalogButton.classList.contains("active")) {
      catalogButton.click();
      sharedRecipeAttempts += 1;
      return;
    }
    const target = [...document.querySelectorAll('[data-open-recipe][data-recipe-source="catalog"]')].find(
      (button) => normalize(button.textContent) === normalize(title),
    );
    if (target) {
      target.click();
      sharedRecipeAttempts = 0;
      return;
    }
    sharedRecipeAttempts += 1;
    if (sharedRecipeAttempts === 25) showToast("Не удалось найти этот рецепт в базе");
  }

  function swipeSignature(history) {
    const first = history[0];
    return first ? `${first.id || ""}:${first.action || ""}:${first.at || ""}` : "";
  }

  function detectSwipeChange() {
    const current = readArray(SWIPE_KEY);
    const previousSignature = swipeSignature(lastSwipeSnapshot);
    const currentSignature = swipeSignature(current);
    if (!currentSignature || currentSignature === previousSignature) {
      lastFavoritesSnapshot = readArray(FAVORITES_KEY);
      return;
    }
    const previousHistory = lastSwipeSnapshot;
    const previousFavorites = lastFavoritesSnapshot;
    const action = current[0]?.action;
    lastSwipeSnapshot = current;
    lastFavoritesSnapshot = readArray(FAVORITES_KEY);
    showUndoToast(action === "save" ? "Сохранено в избранное" : "Рецепт пропущен", () => {
      writeJson(SWIPE_KEY, previousHistory);
      writeJson(FAVORITES_KEY, previousFavorites);
      location.reload();
    });
  }

  function showToast(message) {
    let toast = document.querySelector(".kf-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "kf-toast";
      document.body.append(toast);
    }
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    toast.classList.add("show");
    window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function showUndoToast(message, undo) {
    let toast = document.querySelector(".kf-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "kf-toast";
      document.body.append(toast);
    }
    toast.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" data-kf-action="undo-swipe">Отменить</button>`;
    toast._kfUndo = undo;
    toast.classList.add("show");
    window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => toast.classList.remove("show"), 5500);
  }

  function processDom() {
    mutationQueued = false;
    ensureShoppingUi();
    enhanceRecipeOverlay();
    renderShopping();
    detectSwipeChange();
    tryOpenSharedRecipe();
  }

  function queueProcess() {
    if (mutationQueued) return;
    mutationQueued = true;
    queueMicrotask(processDom);
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-kf-action]");
    if (!target) return;
    const action = target.dataset.kfAction;
    if (action === "portion-down") applyPortions(Math.max(1, currentPortions() - 1));
    if (action === "portion-up") applyPortions(Math.min(12, currentPortions() + 1));
    if (action === "share") shareRecipe();
    if (action === "add-missing") addMissingToShopping();
    if (action === "open-shopping") openShopping();
    if (action === "close-shopping") closeShopping();
    if (action === "clear-bought") clearBought();
    if (action === "move-bought") moveBoughtToKitchen();
    if (action === "undo-swipe") {
      const toast = target.closest(".kf-toast");
      toast?._kfUndo?.();
    }
  });

  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-kf-shopping-id]");
    if (!checkbox) return;
    toggleShoppingItem(checkbox.dataset.kfShoppingId, checkbox.checked);
  });

  window.addEventListener("hashchange", () => {
    sharedRecipeAttempts = 0;
    queueProcess();
  });

  const observer = new MutationObserver(queueProcess);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueProcess();
})();
