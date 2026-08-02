(() => {
  "use strict";

  const KITCHEN_KEY = "kutno-kitchen-v2";
  const SHOPPING_KEY = "kutno-shopping-v2";
  const LEGACY_SHOPPING_KEY = "kutno-shopping-v1";
  const PORTIONS_KEY = "kutno-recipe-portions-v2";
  const LEGACY_PORTIONS_KEY = "kutno-recipe-portions-v1";
  const COOKING_SESSION_KEY = "kutno-active-cooking-v1";
  const SWIPE_KEY = "kutno-swipe-history-v1";
  const FAVORITES_KEY = "kutno-favorites-v1";
  const BASE_STAPLES = ["соль", "вода", "масло", "перец", "растительное масло", "оливковое масло"];
  const FRACTIONS = { "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };
  const NUMBER_TOKEN = String.raw`(?:\d+(?:[.,]\d+)?[¼½¾⅓⅔⅛⅜⅝⅞]?|\d*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+)`;

  let mutationQueued = false;
  let undoTimer = 0;
  let remoteSyncTimer = 0;
  let lastSwipeHistory = readArray(SWIPE_KEY);
  let pendingSwipeSnapshot = null;
  let incomingRecipeHandled = false;
  let incomingRecipeAttempts = 0;
  let syncedUserId = "";
  let cookingSaveTimer = 0;

  function bridge() {
    return window.kutnoBridge || null;
  }

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

  function migrateLegacyData() {
    if (!localStorage.getItem(SHOPPING_KEY)) {
      const legacy = readArray(LEGACY_SHOPPING_KEY);
      if (legacy.length) {
        writeJson(SHOPPING_KEY, legacy.map((item) => ({
          id: item.id || normalize(item.name),
          name: item.name,
          amount: item.amount || "",
          checked: Boolean(item.checked),
          recipeTitles: [item.recipeTitle].filter(Boolean),
          addedAt: Number(item.addedAt) || Date.now(),
          updatedAt: Date.now(),
        })));
      }
    }
    if (!localStorage.getItem(PORTIONS_KEY)) {
      const legacy = readJson(LEGACY_PORTIONS_KEY, {});
      if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
        writeJson(PORTIONS_KEY, Object.fromEntries(Object.entries(legacy).map(([key, value]) => [key, {
          value: Math.max(1, Number(value) || 2),
          updatedAt: Date.now(),
        }])));
      }
    }
  }

  function shoppingItems() {
    return readArray(SHOPPING_KEY).map((item) => ({
      ...item,
      id: item.id || normalize(item.name),
      recipeTitles: Array.isArray(item.recipeTitles) ? item.recipeTitles.filter(Boolean) : [item.recipeTitle].filter(Boolean),
      updatedAt: Number(item.updatedAt) || Number(item.addedAt) || 0,
    }));
  }

  function portionPreferences() {
    const raw = readJson(PORTIONS_KEY, {});
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).map(([key, entry]) => [key, typeof entry === "object" ? {
      value: Math.max(1, Number(entry.value) || 2),
      updatedAt: Number(entry.updatedAt) || 0,
    } : {
      value: Math.max(1, Number(entry) || 2),
      updatedAt: 0,
    }]));
  }

  function cookingSession() {
    const value = readJson(COOKING_SESSION_KEY, null);
    return value && typeof value === "object" ? value : null;
  }

  function localFeatureState() {
    return {
      shopping: shoppingItems(),
      portions: portionPreferences(),
      cooking: cookingSession(),
      updatedAt: Date.now(),
    };
  }

  function mergeShopping(local, remote) {
    const items = new Map();
    [...remote, ...local].forEach((item) => {
      if (!item?.name) return;
      const id = item.id || normalize(item.name);
      const previous = items.get(id);
      if (!previous || Number(item.updatedAt) >= Number(previous.updatedAt)) items.set(id, {
        ...item,
        id,
        recipeTitles: Array.isArray(item.recipeTitles) ? item.recipeTitles.filter(Boolean) : [],
      });
    });
    return [...items.values()].sort((a, b) => Number(b.addedAt) - Number(a.addedAt)).slice(0, 200);
  }

  function mergePortions(local, remote) {
    const result = { ...remote };
    Object.entries(local).forEach(([id, entry]) => {
      if (!result[id] || Number(entry.updatedAt) >= Number(result[id].updatedAt)) result[id] = entry;
    });
    return result;
  }

  function mergeFeatureState(local, remote) {
    const localCooking = local.cooking;
    const remoteCooking = remote?.cooking;
    return {
      shopping: mergeShopping(local.shopping || [], remote?.shopping || []),
      portions: mergePortions(local.portions || {}, remote?.portions || {}),
      cooking: Number(localCooking?.updatedAt || 0) >= Number(remoteCooking?.updatedAt || 0) ? localCooking : remoteCooking,
      updatedAt: Date.now(),
    };
  }

  async function pushFeatureState() {
    const user = bridge()?.getAuthUser?.();
    if (!user) return;
    try {
      await fetch("/api/feature-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(localFeatureState()),
      });
    } catch {
      // Локальная копия остаётся основной до следующего изменения.
    }
  }

  function scheduleFeatureSync() {
    window.clearTimeout(remoteSyncTimer);
    remoteSyncTimer = window.setTimeout(pushFeatureState, 500);
  }

  async function pullFeatureState(user) {
    if (!user?.id || syncedUserId === String(user.id)) return;
    syncedUserId = String(user.id);
    try {
      const response = await fetch("/api/feature-state");
      if (!response.ok) return;
      const data = await response.json();
      const merged = mergeFeatureState(localFeatureState(), data.state || {});
      writeJson(SHOPPING_KEY, merged.shopping);
      writeJson(PORTIONS_KEY, merged.portions);
      if (merged.cooking) writeJson(COOKING_SESSION_KEY, merged.cooking);
      else localStorage.removeItem(COOKING_SESSION_KEY);
      renderShopping();
      renderCookingResume();
      await pushFeatureState();
    } catch {
      // Функции продолжают работать локально.
    }
  }

  function refreshAccountSync() {
    const user = bridge()?.getAuthUser?.();
    if (!user) {
      syncedUserId = "";
      return;
    }
    pullFeatureState(user);
  }

  function parseNumberToken(token) {
    const source = String(token || "").trim().replace(",", ".");
    if (/^\d+\/\d+$/.test(source)) {
      const [top, bottom] = source.split("/").map(Number);
      return bottom ? top / bottom : NaN;
    }
    const fraction = Object.keys(FRACTIONS).find((glyph) => source.includes(glyph));
    const whole = Number(source.replace(fraction || "", "") || 0);
    const value = whole + (fraction ? FRACTIONS[fraction] : 0);
    return Number.isFinite(value) ? value : NaN;
  }

  function parseAmountStructure(text) {
    const original = String(text || "").trim();
    if (!original || /по вкусу|щепот|для жарки|сколько потребуется/i.test(original)) return { kind: "text", original };

    const range = original.match(new RegExp(`^(${NUMBER_TOKEN})\\s*[–—-]\\s*(${NUMBER_TOKEN})\\s*(.*)$`, "iu"));
    if (range) return {
      kind: "range",
      min: parseNumberToken(range[1]),
      max: parseNumberToken(range[2]),
      unit: range[3].trim(),
      original,
    };

    const packageMatch = original.match(new RegExp(`^(${NUMBER_TOKEN})\\s+(банка|банки|банок|упаковка|упаковки|упаковок|пачка|пачки|пачек|бутылка|бутылки|бутылок)(?:\\s+(?:по\\s+)?)?(.*)$`, "iu"));
    if (packageMatch) return {
      kind: "package",
      value: parseNumberToken(packageMatch[1]),
      package: packageMatch[2],
      suffix: packageMatch[3].trim(),
      original,
    };

    const simple = original.match(new RegExp(`^(${NUMBER_TOKEN})\\s*(.*)$`, "iu"));
    if (simple) return {
      kind: "simple",
      value: parseNumberToken(simple[1]),
      unit: simple[2].trim(),
      original,
    };
    return { kind: "text", original };
  }

  function roundedValue(value, unit = "") {
    if (/^(?:кг|г|гр|мл|л)(?:\.|\s|$)/i.test(unit)) return Math.max(5, Math.round(value / 5) * 5);
    if (/шт|зубчик|бан|упаков|пач|бутыл/i.test(unit)) return Math.max(1, Math.round(value));
    if (/ст\.?\s*л|ч\.?\s*л|лож/i.test(unit)) return Math.max(.25, Math.round(value * 4) / 4);
    return Math.max(.25, Math.round(value * 4) / 4);
  }

  function displayNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    const integer = Math.floor(rounded);
    const fraction = Math.round((rounded - integer) * 100) / 100;
    const glyph = fraction === .25 ? "¼" : fraction === .5 ? "½" : fraction === .75 ? "¾" : "";
    if (glyph) return `${integer || ""}${glyph}`;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  }

  function packageWord(word, value) {
    const root = normalize(word);
    const number = Math.round(value);
    const form = number % 100 >= 11 && number % 100 <= 14 ? 5 : number % 10;
    if (root.startsWith("банк")) return form === 1 ? "банка" : form >= 2 && form <= 4 ? "банки" : "банок";
    if (root.startsWith("упаков")) return form === 1 ? "упаковка" : form >= 2 && form <= 4 ? "упаковки" : "упаковок";
    if (root.startsWith("пач")) return form === 1 ? "пачка" : form >= 2 && form <= 4 ? "пачки" : "пачек";
    if (root.startsWith("бутыл")) return form === 1 ? "бутылка" : form >= 2 && form <= 4 ? "бутылки" : "бутылок";
    return word;
  }

  function formatScaledAmount(structure, factor) {
    if (!structure || structure.kind === "text") return structure?.original || "";
    if (structure.kind === "range") {
      const min = roundedValue(structure.min * factor, structure.unit);
      const max = roundedValue(structure.max * factor, structure.unit);
      return `${displayNumber(min)}–${displayNumber(max)} ${structure.unit}`.trim();
    }
    if (structure.kind === "package") {
      const value = roundedValue(structure.value * factor, structure.package);
      const suffix = structure.suffix ? ` по ${structure.suffix}` : "";
      return `${displayNumber(value)} ${packageWord(structure.package, value)}${suffix}`;
    }
    const value = roundedValue(structure.value * factor, structure.unit);
    return `${displayNumber(value)} ${structure.unit}`.trim();
  }

  function mergeAmounts(first, second) {
    if (!first) return second;
    if (!second || normalize(first) === normalize(second)) return first;
    const left = parseAmountStructure(first);
    const right = parseAmountStructure(second);
    if (left.kind === "simple" && right.kind === "simple" && normalize(left.unit) === normalize(right.unit)) {
      return `${displayNumber(roundedValue(left.value + right.value, left.unit))} ${left.unit}`.trim();
    }
    return `${first} + ${second}`;
  }

  function recipeTitle() {
    return document.querySelector("#recipe-title")?.textContent?.trim() || "Рецепт";
  }

  function currentRecipeKey() {
    return bridge()?.getCurrentRecipe?.()?.id || normalize(recipeTitle());
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
    return Math.max(1, Number(span?.textContent?.match(/\d+/)?.[0]) || 2);
  }

  function updatePortionsMeta(value) {
    const span = [...document.querySelectorAll(".sheet-meta span")].find((item) => /порц/i.test(item.textContent || ""));
    if (span) span.textContent = pluralPortions(value);
  }

  function ingredientRows() {
    return [...document.querySelectorAll(".ingredient-ledger > li")];
  }

  function rowIngredientName(row) {
    return (row.querySelector(".ingredient-info-name")?.textContent || row.querySelector(":scope > span")?.textContent || row.querySelector("summary span")?.textContent || "").trim();
  }

  function setPortionPreference(value) {
    const preferences = portionPreferences();
    preferences[currentRecipeKey()] = { value, updatedAt: Date.now() };
    writeJson(PORTIONS_KEY, preferences);
    scheduleFeatureSync();
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
      if (!amount.dataset.kfAmountStructure) amount.dataset.kfAmountStructure = JSON.stringify(parseAmountStructure(amount.dataset.kfBaseAmount));
      amount.textContent = formatScaledAmount(JSON.parse(amount.dataset.kfAmountStructure), factor);
    });
    ledger.dataset.kfCurrentPortions = String(value);
    const output = document.querySelector("[data-kf-portions-output]");
    if (output) output.textContent = pluralPortions(value);
    updatePortionsMeta(value);
    setPortionPreference(value);
    refreshMissingAction();
  }

  function currentPortions() {
    return Math.max(1, Number(document.querySelector(".ingredient-ledger")?.dataset.kfCurrentPortions) || parsePortionsFromMeta());
  }

  function currentKitchenIngredients() {
    const kitchen = readJson(KITCHEN_KEY, {});
    return (Array.isArray(kitchen?.ingredients) ? kitchen.ingredients : []).map(normalize).filter(Boolean);
  }

  function isStaple(name) {
    const value = normalize(name);
    return BASE_STAPLES.some((staple) => value.includes(normalize(staple)));
  }

  function kitchenHas(name, kitchen) {
    const target = normalize(name);
    if (!target || isStaple(target)) return true;
    return kitchen.some((item) => target === item || target.includes(item) || item.includes(target));
  }

  function missingIngredients() {
    const kitchen = currentKitchenIngredients();
    return ingredientRows().map((row) => ({
      name: rowIngredientName(row),
      amount: row.querySelector(":scope > b")?.textContent?.trim() || "",
    })).filter((item) => item.name && !kitchenHas(item.name, kitchen));
  }

  function saveShopping(items) {
    writeJson(SHOPPING_KEY, items.slice(0, 200));
    renderShopping();
    scheduleFeatureSync();
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
        const sameRecipe = existing.recipeTitles.includes(title);
        existing.amount = sameRecipe ? ingredient.amount : mergeAmounts(existing.amount, ingredient.amount);
        existing.checked = false;
        existing.recipeTitles = [...new Set([...existing.recipeTitles, title])].slice(0, 12);
        existing.updatedAt = Date.now();
      } else {
        items.unshift({
          id,
          name: ingredient.name,
          amount: ingredient.amount,
          checked: false,
          recipeTitles: [title],
          addedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
    saveShopping(items);
    showToast(`Добавлено в покупки: ${missing.length}`);
  }

  function ensureShoppingUi() {
    if (!document.querySelector(".kf-shopping-fab")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "kf-shopping-fab";
      button.dataset.kfAction = "open-shopping";
      button.setAttribute("aria-label", "Открыть список покупок");
      document.body.append(button);
    }
    if (!document.querySelector(".kf-shopping-drawer")) {
      const wrapper = document.createElement("div");
      wrapper.className = "kf-shopping-drawer";
      wrapper.hidden = true;
      wrapper.innerHTML = `
        <button class="kf-shopping-backdrop" data-kf-action="close-shopping" aria-label="Закрыть список покупок"></button>
        <section class="kf-shopping-panel" role="dialog" aria-modal="true" aria-labelledby="kf-shopping-title">
          <header><div><p>Кутно / покупки</p><h2 id="kf-shopping-title">Список покупок</h2></div><button type="button" data-kf-action="close-shopping">Закрыть ×</button></header>
          <div class="kf-shopping-list" data-kf-shopping-list></div>
          <footer><button type="button" data-kf-action="move-bought">Купленное → на кухню</button><button type="button" data-kf-action="clear-bought">Убрать отмеченное</button></footer>
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
      fab.hidden = items.length === 0;
      fab.textContent = `Покупки · ${count}`;
      fab.classList.toggle("with-cooking", Boolean(cookingSession()));
    }
    const list = document.querySelector("[data-kf-shopping-list]");
    if (!list) return;
    const signature = JSON.stringify(items);
    if (list.dataset.kfSignature === signature) return;
    list.dataset.kfSignature = signature;
    list.innerHTML = items.length ? items.map((item) => `<label class="kf-shopping-item ${item.checked ? "checked" : ""}">
      <input type="checkbox" data-kf-shopping-id="${escapeAttr(item.id)}" ${item.checked ? "checked" : ""}>
      <span><strong>${escapeHtml(item.name)}</strong>${item.recipeTitles.length ? `<small>${escapeHtml(item.recipeTitles.join(" · "))}</small>` : ""}</span>
      <b>${escapeHtml(item.amount || "")}</b>
    </label>`).join("") : `<div class="kf-shopping-empty"><strong>Пока пусто</strong><p>Добавьте недостающие продукты из любого рецепта.</p></div>`;
  }

  function openShopping() {
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
    item.updatedAt = Date.now();
    saveShopping(items);
  }

  function clearBought() {
    saveShopping(shoppingItems().filter((item) => !item.checked));
  }

  function moveBoughtToKitchen() {
    const items = shoppingItems();
    const bought = items.filter((item) => item.checked);
    if (!bought.length) {
      showToast("Сначала отметьте купленные продукты");
      return;
    }
    bridge()?.addIngredients?.(bought.map((item) => item.name));
    saveShopping(items.filter((item) => !item.checked));
    closeShopping();
    showToast("Купленное добавлено на кухню");
  }

  function refreshMissingAction() {
    const button = document.querySelector("[data-kf-action='add-missing']");
    if (!button) return;
    const missing = missingIngredients();
    button.disabled = missing.length === 0;
    button.textContent = missing.length ? `В покупки · ${missing.length}` : "Все продукты дома";
  }

  function currentRecipeSnapshot() {
    const current = bridge()?.getCurrentRecipe?.();
    if (!current?.recipe) return null;
    const recipe = JSON.parse(JSON.stringify(current.recipe));
    const rows = ingredientRows();
    recipe.ingredients = (recipe.ingredients || []).map((item, index) => ({
      ...item,
      amount: rows[index]?.querySelector(":scope > b")?.textContent?.trim() || item.amount,
    }));
    recipe.portions = currentPortions();
    return { id: current.id, recipe };
  }

  async function shareRecipe() {
    const current = currentRecipeSnapshot();
    if (!current) return;
    let id = current.id;
    try {
      const response = await fetch("/api/shared-recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipe: current.recipe }),
      });
      if (response.ok) id = (await response.json()).id || id;
    } catch {
      // Без аккаунта ссылка всё равно откроет рецепт из локальной базы по ID и названию.
    }
    const url = new URL("/", location.origin);
    url.searchParams.set("recipe", id);
    url.searchParams.set("title", current.recipe.title);
    const data = { title: `${current.recipe.title} — Кутно`, text: `Рецепт «${current.recipe.title}» в Кутно`, url: url.toString() };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        showToast("Ссылка скопирована");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Не удалось поделиться рецептом");
    }
  }

  async function handleIncomingRecipe() {
    if (incomingRecipeHandled || incomingRecipeAttempts > 20 || !bridge()) return;
    const url = new URL(location.href);
    const id = url.searchParams.get("recipe");
    if (!id) {
      incomingRecipeHandled = true;
      return;
    }
    incomingRecipeAttempts += 1;
    let recipe = null;
    try {
      const response = await fetch(`/api/shared-recipes/${encodeURIComponent(id)}`);
      if (response.ok) recipe = (await response.json()).recipe;
    } catch {
      // Пробуем открыть локальную копию.
    }
    const opened = await bridge().openRecipe({ id, title: url.searchParams.get("title") || "", recipe });
    if (opened) incomingRecipeHandled = true;
    else window.setTimeout(queueProcess, 500);
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
      if (!amount) return;
      amount.dataset.kfBaseAmount = amount.textContent.trim();
      amount.dataset.kfAmountStructure = JSON.stringify(parseAmountStructure(amount.textContent));
    });
    const tools = document.createElement("div");
    tools.className = "kf-recipe-tools";
    tools.innerHTML = `<div class="kf-portions" aria-label="Количество порций"><button type="button" data-kf-action="portion-down">−</button><output data-kf-portions-output>${pluralPortions(basePortions)}</output><button type="button" data-kf-action="portion-up">+</button></div><button type="button" class="kf-share" data-kf-action="share">Поделиться ↗</button>`;
    header.append(tools);
    const actions = document.createElement("div");
    actions.className = "kf-ingredient-actions";
    actions.innerHTML = `<button type="button" data-kf-action="add-missing"></button><button type="button" data-kf-action="open-shopping">Открыть покупки</button>`;
    ledger.insertAdjacentElement("afterend", actions);
    const preference = portionPreferences()[currentRecipeKey()];
    applyPortions(preference?.value || basePortions);
  }

  function showToast(message, actionLabel = "", action = null) {
    let toast = document.querySelector(".kf-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "kf-toast";
      document.body.append(toast);
    }
    toast.innerHTML = `<span>${escapeHtml(message)}</span>${actionLabel ? `<button type="button" data-kf-action="toast-action">${escapeHtml(actionLabel)}</button>` : ""}`;
    toast._kfAction = action;
    toast.classList.add("show");
    window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => toast.classList.remove("show"), 6000);
  }

  function captureSwipeSnapshot(event) {
    const target = event.target.closest?.("[data-swipe], .swipe-card.front");
    if (!target) return;
    pendingSwipeSnapshot = bridge()?.getSwipeSnapshot?.() || null;
  }

  function detectSwipeChange() {
    const current = readArray(SWIPE_KEY);
    const previousFirst = lastSwipeHistory[0];
    const currentFirst = current[0];
    const changed = currentFirst && `${currentFirst.id}:${currentFirst.action}:${currentFirst.at}` !== `${previousFirst?.id || ""}:${previousFirst?.action || ""}:${previousFirst?.at || ""}`;
    if (!changed) return;
    lastSwipeHistory = current;
    const snapshot = pendingSwipeSnapshot;
    pendingSwipeSnapshot = null;
    if (!snapshot) return;
    showToast(currentFirst.action === "save" ? "Сохранено в избранное" : "Рецепт пропущен", "Отменить", async () => {
      const restored = await bridge()?.restoreSwipeSnapshot?.(snapshot);
      if (restored) {
        lastSwipeHistory = readArray(SWIPE_KEY);
        showToast("Последний свайп отменён");
      }
    });
  }

  function saveCookingFromBridge() {
    window.clearTimeout(cookingSaveTimer);
    cookingSaveTimer = window.setTimeout(() => {
      const snapshot = bridge()?.getCookingSnapshot?.();
      if (!snapshot) return;
      writeJson(COOKING_SESSION_KEY, snapshot);
      renderCookingResume();
      scheduleFeatureSync();
    }, 80);
  }

  function clearCookingSession() {
    localStorage.removeItem(COOKING_SESSION_KEY);
    renderCookingResume();
    scheduleFeatureSync();
  }

  function renderCookingResume() {
    const session = cookingSession();
    let button = document.querySelector(".kf-cooking-resume");
    if (!session) {
      button?.remove();
      document.querySelector(".kf-shopping-fab")?.classList.remove("with-cooking");
      return;
    }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "kf-cooking-resume";
      button.dataset.kfAction = "resume-cooking";
      document.body.append(button);
    }
    button.textContent = `Вернуться к готовке · шаг ${Number(session.step || 0) + 1}`;
    button.hidden = Boolean(document.querySelector(".cooking-mode"));
    document.querySelector(".kf-shopping-fab")?.classList.add("with-cooking");
  }

  async function resumeCooking() {
    const session = cookingSession();
    if (!session) return;
    const restored = await bridge()?.restoreCookingSession?.(session);
    if (!restored) showToast("Не удалось восстановить рецепт");
    else saveCookingFromBridge();
  }

  function handleFeatureClick(event) {
    const button = event.target.closest("[data-kf-action]");
    if (!button) return;
    const action = button.dataset.kfAction;
    if (action === "portion-down" || action === "portion-up") {
      applyPortions(Math.min(24, Math.max(1, currentPortions() + (action === "portion-up" ? 1 : -1))));
    }
    if (action === "share") shareRecipe();
    if (action === "add-missing") addMissingToShopping();
    if (action === "open-shopping") openShopping();
    if (action === "close-shopping") closeShopping();
    if (action === "clear-bought") clearBought();
    if (action === "move-bought") moveBoughtToKitchen();
    if (action === "resume-cooking") resumeCooking();
    if (action === "toast-action") button.closest(".kf-toast")._kfAction?.();
  }

  function handleMainActionCapture(event) {
    const button = event.target.closest?.("button");
    if (!button) return;
    const action = button.dataset.action;
    if (["start-cooking", "next-cooking-step", "previous-cooking-step", "start-step-timer"].includes(action)) window.setTimeout(saveCookingFromBridge, 120);
    if (["stop-cooking", "finish-cooking"].includes(action)) clearCookingSession();
    if (action === "close-recipe" && document.querySelector(".cooking-mode")) clearCookingSession();
  }

  function handleShoppingChange(event) {
    const input = event.target.closest("[data-kf-shopping-id]");
    if (input) toggleShoppingItem(input.dataset.kfShoppingId, input.checked);
  }

  function processDom() {
    enhanceRecipeOverlay();
    renderShopping();
    renderCookingResume();
    detectSwipeChange();
    if (document.querySelector(".cooking-mode")) saveCookingFromBridge();
    refreshAccountSync();
    handleIncomingRecipe();
  }

  function queueProcess() {
    if (mutationQueued) return;
    mutationQueued = true;
    requestAnimationFrame(() => {
      mutationQueued = false;
      processDom();
    });
  }

  migrateLegacyData();
  document.addEventListener("pointerdown", captureSwipeSnapshot, true);
  document.addEventListener("click", captureSwipeSnapshot, true);
  document.addEventListener("click", handleMainActionCapture, true);
  document.addEventListener("click", handleFeatureClick);
  document.addEventListener("change", handleShoppingChange);
  window.addEventListener("kutno:bridge-ready", queueProcess);
  new MutationObserver(queueProcess).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(refreshAccountSync, 4000);
  queueProcess();
})();
