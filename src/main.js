import "./styles.css";
import { ingredientCatalog } from "./ingredients.js";

const STORAGE_KEY = "kutno-kitchen-v2";
const FAVORITES_KEY = "kutno-favorites-v1";
const COOKING_HISTORY_KEY = "kutno-cooking-history-v1";
const SWIPE_HISTORY_KEY = "kutno-swipe-history-v1";

const quickIngredients = [
  "яйца",
  "картофель",
  "рис",
  "макароны",
  "курица",
  "лук",
  "помидоры",
  "сыр",
  "грибы",
  "гречка",
];

const equipmentOptions = [
  ["pan", "Сковорода"],
  ["pot", "Кастрюля"],
  ["oven", "Духовка"],
  ["blender", "Блендер"],
  ["microwave", "Микроволновка"],
  ["multicooker", "Мультиварка"],
];

const defaults = {
  ingredients: [],
  priorityIngredients: [],
  equipment: ["pan", "pot"],
  difficulty: "легко",
  portions: 2,
  searchMode: "strict",
  maxMinutes: 0,
  course: "все",
};

const fallbackRecipes = [
  {
    title: "Жареный рис с яйцом",
    course: "основное",
    subtitle: "Быстрый ужин на одной сковороде",
    minutes: 20,
    difficulty: "очень просто",
    required: ["рис", "яйца", "лук"],
    equipment: ["Сковорода"],
    why: "Собирается из базовых продуктов и особенно хорош со вчерашним рисом.",
    ingredients: [
      { name: "варёный рис", amount: "300 г" },
      { name: "яйца", amount: "2 шт." },
      { name: "лук", amount: "½ шт." },
      { name: "растительное масло", amount: "1 ст. л." },
      { name: "соль", amount: "по вкусу" },
    ],
    steps: [
      "Нарежьте лук и обжарьте на хорошо разогретой сковороде 3 минуты.",
      "Сдвиньте лук в сторону, разбейте яйца и быстро перемешайте лопаткой.",
      "Добавьте холодный рис, жарьте 5–7 минут, затем приправьте.",
    ],
    tip: "Рис не слипнется, если заранее полностью остудить его.",
  },
  {
    title: "Картофельная тортилья",
    course: "завтрак",
    subtitle: "Испанский омлет без лишних продуктов",
    minutes: 35,
    difficulty: "обычно",
    required: ["картофель", "яйца", "лук"],
    equipment: ["Сковорода", "Крышка или тарелка"],
    why: "Плотное самостоятельное блюдо из трёх привычных ингредиентов.",
    ingredients: [
      { name: "картофель", amount: "450 г" },
      { name: "яйца", amount: "4 шт." },
      { name: "лук", amount: "1 шт." },
      { name: "масло", amount: "3 ст. л." },
      { name: "соль", amount: "по вкусу" },
    ],
    steps: [
      "Тонко нарежьте картофель и лук, посолите.",
      "Готовьте под крышкой на среднем огне 15 минут до мягкости.",
      "Залейте взбитыми яйцами и готовьте ещё 6–8 минут; при желании переверните.",
    ],
    tip: "На небольшом огне середина приготовится, а низ не подгорит.",
  },
  {
    title: "Курица с рисом",
    course: "основное",
    subtitle: "Спокойный домашний ужин в одной кастрюле",
    minutes: 45,
    difficulty: "просто",
    required: ["курица", "рис", "лук"],
    equipment: ["Кастрюля"],
    why: "Не требует отдельного гарнира и хорошо переносит любые специи.",
    ingredients: [
      { name: "курица", amount: "350 г" },
      { name: "рис", amount: "180 г" },
      { name: "лук", amount: "1 шт." },
      { name: "вода", amount: "380 мл" },
      { name: "масло и соль", amount: "по вкусу" },
    ],
    steps: [
      "Обжарьте кусочки курицы до лёгкой корочки и переложите на тарелку.",
      "В той же посуде размягчите лук, всыпьте промытый рис.",
      "Верните курицу, влейте воду и готовьте под крышкой 22 минуты.",
    ],
    tip: "После выключения оставьте блюдо под крышкой ещё на 8 минут.",
  },
  {
    title: "Паста с чесноком и сыром",
    course: "основное",
    subtitle: "Минимальная версия aglio e olio",
    minutes: 18,
    difficulty: "очень просто",
    required: ["макароны", "чеснок", "сыр"],
    equipment: ["Кастрюля", "Сковорода"],
    why: "Соус собирается за то же время, за которое варится паста.",
    ingredients: [
      { name: "макароны", amount: "200 г" },
      { name: "чеснок", amount: "2 зубчика" },
      { name: "сыр", amount: "50 г" },
      { name: "масло", amount: "2 ст. л." },
      { name: "соль", amount: "по вкусу" },
    ],
    steps: [
      "Отварите пасту на минуту меньше времени на упаковке, сохраните стакан воды.",
      "Медленно прогрейте чеснок в масле, не давая ему потемнеть.",
      "Перемешайте пасту с чесночным маслом, сыром и небольшим количеством воды.",
    ],
    tip: "Крахмалистая вода превращает масло и сыр в гладкий соус.",
  },
  {
    title: "Шакшука",
    course: "завтрак",
    subtitle: "Яйца в густом томатном соусе",
    minutes: 25,
    difficulty: "просто",
    required: ["яйца", "помидоры", "лук"],
    equipment: ["Сковорода"],
    why: "Подходит и для завтрака, и для ужина; хлеб здесь необязателен.",
    ingredients: [
      { name: "яйца", amount: "3 шт." },
      { name: "помидоры", amount: "350 г" },
      { name: "лук", amount: "1 шт." },
      { name: "масло", amount: "1 ст. л." },
      { name: "соль", amount: "по вкусу" },
    ],
    steps: [
      "Обжарьте мелко нарезанный лук до прозрачности.",
      "Добавьте помидоры и тушите 10 минут до густоты.",
      "Сделайте углубления, разбейте яйца и готовьте под крышкой 5–7 минут.",
    ],
    tip: "Снимите с огня, когда белок уже схватился, а желток ещё мягкий.",
  },
  {
    title: "Гречка с грибами",
    course: "основное",
    subtitle: "Крупа, которой не нужен сложный соус",
    minutes: 30,
    difficulty: "просто",
    required: ["гречка", "грибы", "лук"],
    equipment: ["Кастрюля", "Сковорода"],
    why: "Сытно без мяса, а вкус держится на хорошо подрумяненных грибах.",
    ingredients: [
      { name: "гречка", amount: "180 г" },
      { name: "грибы", amount: "250 г" },
      { name: "лук", amount: "1 шт." },
      { name: "масло", amount: "1½ ст. л." },
      { name: "соль", amount: "по вкусу" },
    ],
    steps: [
      "Отварите гречку до готовности и оставьте под крышкой.",
      "На сильном огне подрумяньте грибы, затем добавьте лук.",
      "Соедините с гречкой, приправьте и прогрейте 2 минуты.",
    ],
    tip: "Не солите грибы в начале — так они лучше подрумянятся.",
  },
  {
    title: "Яичница",
    course: "завтрак",
    subtitle: "Самый короткий честный рецепт из яиц",
    minutes: 8,
    difficulty: "легко",
    required: ["яйца"],
    equipment: ["Сковорода"],
    why: "Можно приготовить сразу, не добавляя случайных продуктов.",
    ingredients: [{ name: "яйца", amount: "3 шт." }, { name: "масло", amount: "1 ч. л." }, { name: "соль", amount: "по вкусу" }],
    steps: ["Разогрейте масло на сковороде на среднем огне 1 минуту.", "Разбейте яйца на сковороду, посолите и готовьте 3–5 минут, пока белок полностью не схватится.", "Снимите яичницу со сковороды и сразу подавайте."],
    tip: "Для мягкого желтка не накрывайте сковороду крышкой.",
  },
  {
    title: "Отварные яйца",
    course: "завтрак",
    subtitle: "Базовый вариант без сковороды",
    minutes: 12,
    difficulty: "легко",
    required: ["яйца"],
    equipment: ["Кастрюля"],
    why: "Подходит, если дома есть только яйца и базовые продукты.",
    ingredients: [{ name: "яйца", amount: "3 шт." }, { name: "вода", amount: "500 мл" }, { name: "соль", amount: "по вкусу" }],
    steps: ["Положите яйца в кастрюлю и залейте холодной водой так, чтобы вода покрывала яйца.", "Доведите воду до кипения и варите яйца 7–9 минут на среднем огне.", "Слейте горячую воду, охладите яйца под холодной водой и очистите перед подачей."],
    tip: "Яйца легче чистятся после полного охлаждения.",
  },
  {
    title: "Жареный картофель",
    course: "основное",
    subtitle: "Румяный картофель без дополнительных покупок",
    minutes: 28,
    difficulty: "легко",
    required: ["картофель"],
    equipment: ["Сковорода"],
    why: "Один продукт превращается в законченное горячее блюдо.",
    ingredients: [{ name: "картофель", amount: "500 г" }, { name: "масло", amount: "1,5 ст. л." }, { name: "соль", amount: "по вкусу" }],
    steps: ["Очистите картофель, нарежьте одинаковыми брусочками и обсушите полотенцем.", "Разогрейте масло на сковороде, выложите картофель одним слоем и жарьте 18–22 минуты на среднем огне, переворачивая каждые 4–5 минут.", "Посолите готовый картофель, снимите со сковороды и подавайте горячим."],
    tip: "Сухая поверхность картофеля помогает получить корочку.",
  },
  {
    title: "Рассыпчатый рис",
    course: "основное",
    subtitle: "Простой рис на воде",
    minutes: 25,
    difficulty: "легко",
    required: ["рис"],
    equipment: ["Кастрюля"],
    why: "Надёжный базовый вариант, когда других продуктов нет.",
    ingredients: [{ name: "рис", amount: "180 г" }, { name: "вода", amount: "360 мл" }, { name: "соль", amount: "по вкусу" }],
    steps: ["Промойте рис холодной водой до прозрачности стекающей воды.", "Положите рис в кастрюлю, влейте воду, посолите и доведите до кипения.", "Уменьшите огонь до слабого, накройте кастрюлю и варите 15 минут, затем снимите с огня и оставьте под крышкой ещё 5 минут."],
    tip: "Не перемешивайте рис во время варки.",
  },
  {
    title: "Макароны с маслом",
    course: "основное",
    subtitle: "Базовая паста без готового соуса",
    minutes: 15,
    difficulty: "легко",
    required: ["макароны"],
    equipment: ["Кастрюля"],
    why: "Быстрый и предсказуемый вариант из одного основного продукта.",
    ingredients: [{ name: "макароны", amount: "200 г" }, { name: "вода", amount: "1 л" }, { name: "масло", amount: "1 ст. л." }, { name: "соль", amount: "по вкусу" }],
    steps: ["Налейте воду в кастрюлю, посолите и доведите до активного кипения.", "Опустите макароны в кипящую воду и варите по времени на упаковке до готовности.", "Слейте воду, добавьте масло к горячим макаронам, перемешайте и подавайте."],
    tip: "Оставьте пару ложек воды от варки, если макароны кажутся сухими.",
  },
];

function scaleFallbackAmount(amount, portions) {
  const text = String(amount || "").trim();
  if (!text || /по вкусу/i.test(text)) return text;
  const match = text.replace(",", ".").match(/^(\d+)?([½¼¾])?\s*(.*)$/u);
  if (!match || (!match[1] && !match[2])) return text;
  const fractions = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
  const base = Number(match[1] || 0) + (fractions[match[2]] || 0);
  const unit = match[3].trim();
  let value = base * (Math.max(1, Number(portions) || 1) / 2);
  if (/^(?:г|мл)(?:\.|\s|$)/i.test(unit)) value = Math.max(5, Math.round(value / 5) * 5);
  else if (/шт/i.test(unit)) value = Math.max(1, Math.round(value));
  else value = Math.max(0.5, Math.round(value * 2) / 2);
  const display = Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  return `${display} ${unit}`.trim();
}

function scaledFallbackRecipe(recipe, portions) {
  return {
    ...recipe,
    portions,
    ingredients: recipe.ingredients.map((item) => ({
      ...item,
      amount: scaleFallbackAmount(item.amount, portions),
    })),
  };
}

function normalizeStoredFavorite(recipe) {
  if (!recipe) return recipe;
  const dedupe = (items, signature) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      const key = signature(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  let normalizedRecipe = {
    ...recipe,
    ingredients: dedupe(recipe.ingredients, (item) => normalize(String(item?.name || ""))),
    steps: dedupe(recipe.steps, (step) => normalize(String(step || "")).replace(/[^а-яa-z0-9]+/gu, " ").trim()),
  };
  if (normalizedRecipe.source?.type !== "curated") return normalizedRecipe;
  const template = fallbackRecipes.find((item) => normalize(item.title) === normalize(String(normalizedRecipe.title || "")));
  if (!template) return normalizedRecipe;
  const stillUsesTemplateAmounts = template.ingredients.every((item, index) => normalizedRecipe.ingredients[index]?.amount === item.amount);
  if (stillUsesTemplateAmounts) normalizedRecipe = scaledFallbackRecipe(normalizedRecipe, Number(normalizedRecipe.portions) || 2);
  return normalizedRecipe;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const next = { ...defaults, ...saved };
    if (!["легко", "обычно", "сложно"].includes(next.difficulty)) next.difficulty = defaults.difficulty;
    if (!["strict", "plus-one"].includes(next.searchMode)) next.searchMode = defaults.searchMode;
    if (![0, 15, 30, 60].includes(Number(next.maxMinutes))) next.maxMinutes = defaults.maxMinutes;
    if (!["все", "завтрак", "суп", "основное", "перекус"].includes(next.course)) next.course = defaults.course;
    next.priorityIngredients = Array.isArray(next.priorityIngredients)
      ? next.priorityIngredients.filter((item) => next.ingredients?.includes(item)).slice(0, 3)
      : [];
    return next;
  } catch {
    return { ...defaults };
  }
}

function loadFavoriteRecipes() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(saved) ? saved.slice(0, 100).map(normalizeStoredFavorite) : [];
  } catch {
    return [];
  }
}

function loadLocalList(key, limit = 200) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved.slice(0, limit) : [];
  } catch {
    return [];
  }
}

let state = loadState();
let recipes = [];
let favoriteRecipes = loadFavoriteRecipes();
let cookingHistory = loadLocalList(COOKING_HISTORY_KEY);
let swipeHistory = loadLocalList(SWIPE_HISTORY_KEY, 500);
let ingredientsExpanded = false;
let clearProductsConfirmationOpen = false;
let isLoading = false;
let isLoadingMore = false;
let loadMoreMessage = "";
let hasMoreRecipes = false;
let activeRecipe = null;
let cookingMode = false;
let cookingStep = 0;
let cookingTimer = null;
let cookingTimerEndsAt = 0;
let cookingTimerInterval = null;
let cookingWakeLock = null;
let generationError = "";
let authUser = null;
let authModalOpen = false;
let authError = "";
let authBusy = false;
let remoteSaveTimer = null;
let googleClientPromise = null;
let googleConfigPromise = null;
let googleConfigured = false;
let ingredientSuggestions = [];
let activeSuggestionIndex = -1;
let recentRecipeTitles = [];
let recentSourceIds = [];
let currentView = ["kitchen", "catalog", "swipe", "favorites"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "kitchen";
let catalogRecipes = [];
let catalogLoading = false;
let catalogError = "";
let catalogCuisine = "все";
let catalogDifficulty = "все";
let catalogCourse = "все";
let catalogProtein = "все";
let catalogAvailability = "все";
let catalogMaxMinutes = 0;
let catalogQuery = "";
let swipeIndex = 0;
let swipeRecipes = [];
let swipeBusy = false;
let swipeGesture = null;
let swipeHintPending = currentView === "swipe";

const app = document.querySelector("#app");

function normalize(value) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function difficultyValue(value) {
  const normalized = normalize(String(value || ""));
  if (/слож|труд/.test(normalized)) return "сложно";
  if (/обыч|сред/.test(normalized)) return "обычно";
  return "легко";
}

function ingredientMatches(first = "", second = "") {
  const left = normalize(String(first)).replace(/[^а-яa-z0-9]+/gu, " ").trim();
  const right = normalize(String(second)).replace(/[^а-яa-z0-9]+/gu, " ").trim();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function catalogMissingIngredients(recipe) {
  return (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .filter((item) => !item?.pantry)
    .filter((item) => !state.ingredients.some((owned) => [item.name, ...(item.aliases || [])].some((candidate) => ingredientMatches(candidate, owned))))
    .map((item) => item.name);
}

function recipePriorityScore(recipe) {
  return state.priorityIngredients.reduce((score, ingredient) => score + Number((recipe.ingredients || [])
    .some((item) => [item.name, ...(item.aliases || [])].some((candidate) => ingredientMatches(candidate, ingredient)))), 0);
}

function cookingRecord(recipe) {
  const id = recipeId(recipe);
  return cookingHistory.find((item) => item?.id === id) || null;
}

function saveCookingHistory() {
  localStorage.setItem(COOKING_HISTORY_KEY, JSON.stringify(cookingHistory.slice(0, 200)));
  if (authUser) syncKitchen();
}

function saveSwipeHistory() {
  localStorage.setItem(SWIPE_HISTORY_KEY, JSON.stringify(swipeHistory.slice(0, 500)));
  if (authUser) syncKitchen();
}

function recipeId(recipe) {
  const signature = [
    normalize(String(recipe?.title || "")),
    ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
      .map((item) => normalize(String(item?.name || "")))
      .sort(),
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `r-${(hash >>> 0).toString(36)}`;
}

function saveFavoritesLocally() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteRecipes.slice(0, 100)));
}

function isFavorite(recipe) {
  const id = recipeId(recipe);
  return favoriteRecipes.some((item) => recipeId(item) === id);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (authUser) {
    clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(syncKitchen, 450);
  }
}

function kitchenPayload() {
  return {
    ingredients: state.ingredients,
    priorityIngredients: state.priorityIngredients,
    equipment: state.equipment,
    difficulty: state.difficulty,
    portions: state.portions,
    searchMode: state.searchMode,
    maxMinutes: state.maxMinutes,
    course: state.course,
    cookingHistory: cookingHistory.slice(0, 200),
    swipeHistory: swipeHistory.slice(0, 500),
  };
}

async function syncKitchen() {
  if (!authUser) return;
  try {
    const response = await fetch("/api/kitchen", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kitchenPayload()),
    });
    if (!response.ok) throw new Error("sync failed");
  } catch {
    // Локальная копия остаётся основной до следующего изменения.
  }
}

function applyRemoteKitchen(kitchen) {
  if (!kitchen || typeof kitchen !== "object") return false;
  const hasRemoteData = (Array.isArray(kitchen.ingredients) && kitchen.ingredients.length > 0)
    || (Array.isArray(kitchen.cookingHistory) && kitchen.cookingHistory.length > 0)
    || (Array.isArray(kitchen.swipeHistory) && kitchen.swipeHistory.length > 0);
  if (!hasRemoteData) return false;
  state = {
    ...state,
    ingredients: kitchen.ingredients.map(normalize).filter(Boolean),
    priorityIngredients: Array.isArray(kitchen.priorityIngredients) ? kitchen.priorityIngredients.map(normalize).filter(Boolean).slice(0, 3) : [],
    equipment: Array.isArray(kitchen.equipment) ? kitchen.equipment : state.equipment,
    difficulty: ["легко", "обычно", "сложно"].includes(kitchen.difficulty) ? kitchen.difficulty : state.difficulty,
    portions: Number(kitchen.portions) || state.portions,
    searchMode: ["strict", "plus-one"].includes(kitchen.searchMode) ? kitchen.searchMode : state.searchMode,
    maxMinutes: [0, 15, 30, 60].includes(Number(kitchen.maxMinutes)) ? Number(kitchen.maxMinutes) : state.maxMinutes,
    course: ["все", "завтрак", "суп", "основное", "перекус"].includes(kitchen.course) ? kitchen.course : state.course,
  };
  if (Array.isArray(kitchen.cookingHistory)) {
    cookingHistory = kitchen.cookingHistory.slice(0, 200);
    localStorage.setItem(COOKING_HISTORY_KEY, JSON.stringify(cookingHistory));
  }
  if (Array.isArray(kitchen.swipeHistory)) {
    swipeHistory = kitchen.swipeHistory.slice(0, 500);
    localStorage.setItem(SWIPE_HISTORY_KEY, JSON.stringify(swipeHistory));
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return true;
}

async function restoreSession() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) return;
    const data = await response.json();
    authUser = data.user;
    if (!applyRemoteKitchen(data.kitchen)) await syncKitchen();
    await restoreFavorites();
    render();
  } catch {
    // Приложение продолжает работать с локально сохранённой кухней.
  }
}

async function restoreFavorites() {
  if (!authUser) return;
  try {
    const response = await fetch("/api/favorites");
    if (!response.ok) return;
    const data = await response.json();
    const remote = Array.isArray(data.favorites) ? data.favorites.map(normalizeStoredFavorite) : [];
    const localById = new Map(favoriteRecipes.map((recipe) => [recipeId(recipe), recipe]));
    const remoteById = new Map(remote.map((recipe) => [recipeId(recipe), recipe]));
    favoriteRecipes = [...remote, ...favoriteRecipes.filter((recipe) => !remoteById.has(recipeId(recipe)))].slice(0, 100);
    saveFavoritesLocally();
    const unsynced = [...localById].filter(([id]) => !remoteById.has(id)).map(([, recipe]) => recipe);
    await Promise.all(unsynced.map((recipe) => fetch("/api/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipe }),
    })));
  } catch {
    // Локальное избранное остаётся доступным без сети.
  }
}

async function toggleFavorite(recipe, trigger) {
  if (!recipe) return;
  const id = recipeId(recipe);
  const wasFavorite = favoriteRecipes.some((item) => recipeId(item) === id);
  const sheetScroll = document.querySelector(".recipe-sheet")?.scrollTop || 0;
  favoriteRecipes = wasFavorite
    ? favoriteRecipes.filter((item) => recipeId(item) !== id)
    : [{ ...recipe, id, portions: Number(recipe.portions) || state.portions }, ...favoriteRecipes];
  saveFavoritesLocally();
  if (trigger && !activeRecipe && currentView !== "favorites") {
    const favorite = !wasFavorite;
    trigger.classList.toggle("active", favorite);
    trigger.textContent = favorite ? "♥" : "♡";
    trigger.setAttribute("aria-label", favorite ? "Убрать из избранного" : "Сохранить в избранное");
    const favoritesNav = document.querySelector('.header-nav [data-view="favorites"]');
    if (favoritesNav) favoritesNav.textContent = `Избранное${favoriteRecipes.length ? ` · ${favoriteRecipes.length}` : ""}`;
  } else {
    render();
  }
  if (activeRecipe) requestAnimationFrame(() => {
    const sheet = document.querySelector(".recipe-sheet");
    if (sheet) sheet.scrollTop = sheetScroll;
  });

  if (!authUser) return;
  try {
    await fetch(wasFavorite ? `/api/favorites/${encodeURIComponent(id)}` : "/api/favorites", {
      method: wasFavorite ? "DELETE" : "POST",
      headers: wasFavorite ? undefined : { "content-type": "application/json" },
      body: wasFavorite ? undefined : JSON.stringify({ recipe }),
    });
  } catch {
    // Изменение синхронизируется при следующем входе.
  }
}

function loadGoogleClient() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleClientPromise) return googleClientPromise;
  googleClientPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const script = existing || document.createElement("script");
    const timeout = setTimeout(() => reject(new Error("Google client timeout")), 12000);
    script.addEventListener("load", () => {
      clearTimeout(timeout);
      window.google?.accounts?.id ? resolve(window.google) : reject(new Error("Google client unavailable"));
    }, { once: true });
    script.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Google client failed to load"));
    }, { once: true });
    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });
  return googleClientPromise;
}

function getGoogleConfig() {
  if (!googleConfigPromise) {
    googleConfigPromise = fetch("/api/config")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Config unavailable")))
      .then((data) => {
        if (!data.googleClientId) throw new Error("Google Client ID missing");
        return data.googleClientId;
      });
  }
  return googleConfigPromise;
}

async function mountGoogleButton() {
  const container = document.querySelector("#google-signin-button");
  if (!container || authBusy) return;
  try {
    const [google, clientId] = await Promise.all([loadGoogleClient(), getGoogleConfig()]);
    if (!document.body.contains(container)) return;
    if (!googleConfigured) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        ux_mode: "popup",
        use_fedcm_for_button: true,
      });
      googleConfigured = true;
    }
    container.replaceChildren();
    google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      width: Math.min(400, Math.max(260, container.clientWidth)),
      locale: "ru",
    });
  } catch {
    container.innerHTML = `<p class="google-load-error">Не удалось загрузить вход Google. Проверьте блокировщик контента и обновите страницу.</p>`;
  }
}

async function handleGoogleCredential(response) {
  if (authBusy || !response?.credential) return;
  authBusy = true;
  authError = "";
  render();
  try {
    const authResponse = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await authResponse.json();
    if (!authResponse.ok) throw new Error(data.error || "Не получилось войти через Google");
    authUser = data.user;
    if (!applyRemoteKitchen(data.kitchen)) await syncKitchen();
    await restoreFavorites();
    authModalOpen = false;
  } catch (error) {
    authError = error instanceof Error ? error.message : "Попробуйте ещё раз";
  } finally {
    authBusy = false;
    render();
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function equipmentName(id) {
  return equipmentOptions.find(([value]) => value === id)?.[1] || id;
}

function currentIngredientQuery(value) {
  return normalize(String(value).split(/[,;\n]+/).at(-1) || "");
}

function findIngredientSuggestions(value) {
  const query = currentIngredientQuery(value);
  if (query.length < 2) return [];

  const selected = new Set(state.ingredients.map(normalize));
  return ingredientCatalog
    .map((name) => {
      const normalizedName = normalize(name);
      const matchIndex = normalizedName.indexOf(query);
      if (matchIndex < 0 || selected.has(normalizedName)) return null;

      const wordStartsWithQuery = normalizedName.split(/[\s-]+/).some((word) => word.startsWith(query));
      const matchGroup = normalizedName.startsWith(query) ? 0 : wordStartsWithQuery ? 1 : 2;
      const sauceBonus = normalizedName.includes("соус") ? -0.2 : 0;
      return { name, score: matchGroup * 100 + matchIndex + sauceBonus + normalizedName.length / 1000 };
    })
    .filter(Boolean)
    .sort((first, second) => first.score - second.score || first.name.localeCompare(second.name, "ru"))
    .slice(0, 6)
    .map(({ name }) => name);
}

function paintSuggestionSelection() {
  const input = document.querySelector("#ingredient-input");
  const options = [...document.querySelectorAll(".ingredient-suggestion")];
  options.forEach((option, index) => {
    const isActive = index === activeSuggestionIndex;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });
  const activeOption = options[activeSuggestionIndex];
  if (input) {
    if (activeOption) input.setAttribute("aria-activedescendant", activeOption.id);
    else input.removeAttribute("aria-activedescendant");
  }
  activeOption?.scrollIntoView({ block: "nearest" });
}

function updateIngredientSuggestions(value) {
  const input = document.querySelector("#ingredient-input");
  const list = document.querySelector("#ingredient-suggestions");
  if (!input || !list) return;

  ingredientSuggestions = findIngredientSuggestions(value);
  activeSuggestionIndex = ingredientSuggestions.length ? 0 : -1;
  input.setAttribute("aria-expanded", String(ingredientSuggestions.length > 0));
  input.removeAttribute("aria-activedescendant");
  list.hidden = !ingredientSuggestions.length;
  list.innerHTML = ingredientSuggestions.map((name, index) => `
    <button
      type="button"
      id="ingredient-suggestion-${index}"
      class="ingredient-suggestion ${index === activeSuggestionIndex ? "active" : ""}"
      role="option"
      aria-selected="${index === activeSuggestionIndex}"
      data-suggest-ingredient="${escapeHtml(name)}"
    >
      <span>${escapeHtml(name)}</span>
      <span>добавить</span>
    </button>`).join("");
}

function chooseIngredientSuggestion(name) {
  const input = document.querySelector("#ingredient-input");
  if (!input || !name) return;
  const completedValues = input.value.split(/[,;\n]+/).slice(0, -1);
  ingredientSuggestions = [];
  activeSuggestionIndex = -1;
  addIngredients([...completedValues, name]);
  requestAnimationFrame(() => document.querySelector("#ingredient-input")?.focus({ preventScroll: true }));
}

function renderPotLoader(className = "") {
  return `<img class="pot-loader ${className}" src="/illustrations/pot-loader.gif" alt="" aria-hidden="true">`;
}

function renderKitchenView() {
  const ingredientsCollapsible = state.ingredients.length > 8;
  const ingredientsCollapsed = ingredientsCollapsible && !ingredientsExpanded;
  const sortedIngredients = [...state.ingredients].sort((first, second) => first.localeCompare(second, "ru", { sensitivity: "base" }));
  return `
    <section class="intro-grid" aria-labelledby="main-title">
      <div class="intro-copy">
        <p class="eyebrow">Рецепты из того, что уже дома</p>
        <h1 id="main-title">Сначала —<br>что есть<br>на кухне?</h1>
        <figure class="section-illustration kitchen-illustration" aria-hidden="true">
          <img src="/illustrations/kitchen-hero.webp" alt="">
        </figure>
      </div>

      <div class="kitchen-form">
        <section class="form-section ingredient-section">
          <div class="section-index">01</div>
          <div class="section-content">
            <label for="ingredient-input">Продукты</label>
            <form id="ingredient-form" class="ingredient-form">
              <input id="ingredient-input" autocomplete="off" placeholder="Курица, рис, лук" aria-describedby="ingredient-hint" role="combobox" aria-autocomplete="list" aria-controls="ingredient-suggestions" aria-expanded="false">
              <button type="submit" aria-label="Добавить продукты">Добавить</button>
            </form>
            <div id="ingredient-suggestions" class="ingredient-suggestions" role="listbox" aria-label="Подходящие продукты" hidden></div>
            <p id="ingredient-hint" class="microcopy">Можно перечислить несколько продуктов через запятую. Соль, воду и масло можно не указывать — мы считаем их базовыми.</p>
            <div class="selected-ingredients ${ingredientsCollapsed ? "is-collapsed" : ""}" aria-live="polite">
              ${state.ingredients.length
                ? sortedIngredients.map((item) => `<button class="ingredient-tag selected" data-remove-ingredient="${escapeHtml(item)}">${escapeHtml(item)} <span aria-hidden="true">×</span></button>`).join("")
                : `<span class="empty-line">Пока пусто — начните с главного продукта</span>`}
            </div>
            ${state.ingredients.length ? `<div class="ingredient-list-actions">
              ${ingredientsCollapsible ? `<button class="ingredients-toggle" data-action="toggle-ingredients" aria-expanded="${ingredientsExpanded}">${ingredientsExpanded ? "Свернуть" : `Показать все · ${state.ingredients.length}`}</button>` : ""}
              <button class="ingredients-clear" data-action="request-clear-products">Очистить продукты</button>
            </div>` : ""}
            ${state.ingredients.length > 1 ? `<div class="priority-products ${ingredientsCollapsed ? "is-collapsed" : ""}">
              <span>Использовать сначала</span>
              <div>${sortedIngredients.map((item) => `<button class="${state.priorityIngredients.includes(item) ? "active" : ""}" data-priority-ingredient="${escapeHtml(item)}" aria-pressed="${state.priorityIngredients.includes(item)}">${escapeHtml(item)}</button>`).join("")}</div>
            </div>` : ""}
            <div class="quick-row ${ingredientsCollapsed ? "is-collapsed" : ""}" aria-label="Частые продукты" aria-hidden="${ingredientsCollapsed}">
              ${quickIngredients.filter((item) => !state.ingredients.includes(normalize(item))).slice(0, 7).map((item) => `<button class="ingredient-tag" data-add-ingredient="${item}">+ ${item}</button>`).join("")}
            </div>
          </div>
        </section>

        <section class="form-section">
          <div class="section-index">02</div>
          <div class="section-content">
            <span class="field-label">Что умеет кухня</span>
            <div class="equipment-grid">
              ${equipmentOptions.map(([id, name]) => `
                <button class="equipment-option ${state.equipment.includes(id) ? "active" : ""}" data-equipment="${id}" aria-pressed="${state.equipment.includes(id)}">
                  <span class="equipment-mark" aria-hidden="true">${state.equipment.includes(id) ? "●" : "○"}</span>${name}
                </button>`).join("")}
            </div>
          </div>
        </section>

        <section class="form-section search-preferences-section">
          <div class="section-index">03</div>
          <div class="section-content search-preferences-grid">
            <fieldset>
              <legend>Режим</legend>
              <div class="segmented search-mode">
                <button type="button" class="${state.searchMode === "strict" ? "active" : ""}" data-search-mode="strict">Без покупок</button>
                <button type="button" class="${state.searchMode === "plus-one" ? "active" : ""}" data-search-mode="plus-one">Можно докупить 1</button>
              </div>
            </fieldset>
            <fieldset>
              <legend>Время</legend>
              <div class="segmented">
                ${[[0, "любое"], [15, "15 мин"], [30, "30 мин"], [60, "60 мин"]].map(([value, label]) => `<button type="button" class="${Number(state.maxMinutes) === value ? "active" : ""}" data-max-minutes="${value}">${label}</button>`).join("")}
              </div>
            </fieldset>
            <fieldset>
              <legend>Что приготовить</legend>
              <div class="segmented">
                ${["все", "завтрак", "суп", "основное", "перекус"].map((value) => `<button type="button" class="${state.course === value ? "active" : ""}" data-kitchen-course="${value}">${value === "все" ? "любое" : value}</button>`).join("")}
              </div>
            </fieldset>
          </div>
        </section>

        <section class="form-section preferences-section">
          <div class="section-index">04</div>
          <div class="section-content preference-columns">
            <fieldset>
              <legend>Сложность</legend>
              <div class="segmented">
                ${["легко", "обычно", "сложно"].map((value) => `<button type="button" class="${state.difficulty === value ? "active" : ""}" data-difficulty="${value}">${value}</button>`).join("")}
              </div>
            </fieldset>
            <fieldset>
              <legend>Порции</legend>
              <div class="stepper">
                <button type="button" data-portions="-1" aria-label="Уменьшить число порций">−</button>
                <output aria-live="polite">${state.portions}</output>
                <button type="button" data-portions="1" aria-label="Увеличить число порций">+</button>
              </div>
            </fieldset>
          </div>
        </section>

        <button class="primary-action" data-action="generate" ${!state.ingredients.length || isLoading ? "disabled" : ""}>
          <span>${isLoading ? "Составляем меню" : "Предложить блюда"}</span>
          ${isLoading ? renderPotLoader("pot-loader-small") : `<span class="action-arrow" aria-hidden="true">↘︎</span>`}
        </button>
        ${!state.ingredients.length ? `<p class="action-note">Добавьте хотя бы один продукт</p>` : ""}
        <p class="save-status">${authUser ? `Кухня сохранена в аккаунте ${escapeHtml(authUser.email)}` : `Кухня сохранена на этом устройстве. <button data-action="account">Войдите</button>, чтобы открыть её на другом.`}</p>
      </div>
    </section>
    ${renderResults()}`;
}

function restorePageScroll(top) {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, top);
  requestAnimationFrame(() => {
    window.scrollTo(0, top);
    root.style.scrollBehavior = previousBehavior;
  });
}

function render({ preserveScroll = true } = {}) {
  const scrollTop = window.scrollY;
  ingredientSuggestions = [];
  activeSuggestionIndex = -1;
  app.innerHTML = `
    <div class="page-shell">
      <header class="site-header">
        <button class="wordmark" data-view="kitchen" aria-label="Кутно, на главную"><img class="wordmark-symbol" src="/kutno-mark.svg" alt=""><img class="wordmark-lettering" src="/kutno-wordmark.svg" alt="Кутно"></button>
        <nav class="header-nav" aria-label="Разделы Кутно">
          ${[["kitchen", "Кухня"], ["catalog", "База"], ["swipe", "АМ ❤️"], ["favorites", `Избранное${favoriteRecipes.length ? ` · ${favoriteRecipes.length}` : ""}`]].map(([id, label]) => `<button class="${currentView === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}
        </nav>
        <div class="header-actions">
          <button class="account-button" data-action="account">${authUser ? escapeHtml(authUser.name) : "Войти"}</button>
        </div>
      </header>

      <main id="top">
        ${currentView === "kitchen" ? renderKitchenView() : currentView === "catalog" ? renderCatalogView() : currentView === "swipe" ? renderSwipeView() : renderFavoritesView()}
      </main>

      <footer class="site-footer" aria-label="О Кутно">
        <section class="footer-about" aria-labelledby="footer-about-title">
          <h2 id="footer-about-title">О сайте</h2>
          <p>Подбирает блюда из продуктов, которые уже есть дома, с учётом доступной техники, сложности и числа порций. Рецепты из базы и новые варианты проверяются перед показом.</p>
        </section>
        <div class="footer-bottom">
          <a class="footer-feedback" href="https://t.me/oskrenh" target="_blank" rel="noopener noreferrer">Обратная связь <span class="footer-arrow" aria-hidden="true"></span></a>
          <span class="footer-copyright">© ${new Date().getFullYear()} Кутно</span>
        </div>
      </footer>
    </div>
    ${activeRecipe ? renderRecipeOverlay(activeRecipe) : ""}
    ${authModalOpen ? renderAuthOverlay() : ""}
    ${clearProductsConfirmationOpen ? renderClearProductsConfirmation() : ""}
  `;
  if (preserveScroll) restorePageScroll(scrollTop);
  requestAnimationFrame(clampSelectedIngredients);
  if (clearProductsConfirmationOpen) requestAnimationFrame(() => document.querySelector("[data-action='cancel-clear-products']")?.focus());
  if (authModalOpen && !authUser && !authBusy) requestAnimationFrame(mountGoogleButton);
  if (currentView === "swipe" && swipeHintPending && document.querySelector(".swipe-card.front")) swipeHintPending = false;
}

function clampSelectedIngredients() {
  const list = document.querySelector(".selected-ingredients");
  if (!list) return;
  const tags = [...list.querySelectorAll(".ingredient-tag.selected")];
  tags.forEach((tag) => { tag.hidden = false; });
  list.style.setProperty("--ingredients-expanded-height", `${list.scrollHeight}px`);
  const quick = document.querySelector(".quick-row");
  if (quick) quick.style.setProperty("--quick-row-height", `${quick.scrollHeight}px`);
  const listTop = list.getBoundingClientRect().top;
  const rowTops = [];
  for (const tag of tags) {
    const top = tag.getBoundingClientRect().top - listTop;
    if (!rowTops.some((rowTop) => Math.abs(rowTop - top) < 2)) rowTops.push(top);
  }
  if (rowTops.length < 3) return;
  const secondRowTop = rowTops[1];
  const secondRowBottom = Math.max(...tags
    .map((tag) => ({ tag, top: tag.getBoundingClientRect().top - listTop }))
    .filter(({ top }) => Math.abs(top - secondRowTop) < 2)
    .map(({ tag, top }) => top + tag.offsetHeight));
  list.style.setProperty("--ingredients-collapsed-height", `${secondRowBottom}px`);
}

function renderResults() {
  if (isLoading) {
    return `
      <section class="results-section loading-results" aria-live="polite">
        <div class="results-heading"><span>Меню</span><h2>Готовим варианты</h2>${renderPotLoader("pot-loader-large")}</div>
        <div class="loading-rule"></div><div class="loading-rule short"></div><div class="loading-rule"></div>
      </section>`;
  }

  if (!recipes.length) {
    if (generationError) {
      return `<section class="generation-error" id="results" aria-live="polite">
        <span>Для этого набора пока нет надёжного рецепта</span>
        <p>${escapeHtml(generationError)}</p>
        <button data-action="generate">Попробовать ещё раз</button>
      </section>`;
    }
    return `
      <section class="manifesto-strip" aria-label="Как работает Кутно">
        <div><b>01</b><span>Запишите продукты</span></div>
        <div><b>02</b><span>Отметьте технику</span></div>
        <div><b>03</b><span>Выберите блюдо</span></div>
      </section>`;
  }

  return `
    <section class="results-section" id="results" aria-labelledby="results-title">
      <div class="results-heading">
        <span>Меню / ${recipes.length.toString().padStart(2, "0")}</span>
        <h2 id="results-title">Из того,<br>что есть</h2>
        <p>Варианты расположены от самого подходящего. Базовые специи и масло не считаются.</p>
      </div>
      <div class="recipe-list">
        ${recipes.map((recipe, index) => renderRecipeCard(recipe, index, "recipes")).join("")}
        <div class="recipe-list-actions ${hasMoreRecipes || isLoadingMore ? "" : "is-exhausted"}">
          ${hasMoreRecipes || isLoadingMore ? `<button class="load-more-recipes" data-action="load-more" ${isLoadingMore ? "disabled" : ""}>
            <span>${isLoadingMore ? "Загружаем" : "Загрузить ещё"}</span>
            ${isLoadingMore ? renderPotLoader("pot-loader-small") : `<span aria-hidden="true">↓</span>`}
          </button>` : `<p class="load-more-message" role="status">Для этого набора показаны все надёжные варианты.</p>`}
          ${loadMoreMessage ? `<p class="load-more-message" role="status">${escapeHtml(loadMoreMessage)}</p>` : ""}
        </div>
      </div>
    </section>`;
}

function renderFavorites() {
  if (!favoriteRecipes.length) return "";
  return `
    <section class="results-section favorites-section" id="favorites" aria-labelledby="favorites-title">
      <div class="results-heading">
        <span>Сохранено / ${favoriteRecipes.length.toString().padStart(2, "0")}</span>
        <h2 id="favorites-title">Избранное</h2>
        <p>${authUser ? "Рецепты сохранены в вашем аккаунте." : "Рецепты сохранены на этом устройстве. Войдите, чтобы синхронизировать их."}</p>
        <figure class="section-illustration favorites-list-illustration" aria-hidden="true">
          <img src="/illustrations/favorites-hero.webp" alt="">
        </figure>
      </div>
      <div class="recipe-list">
        ${favoriteRecipes.map((recipe, index) => renderRecipeCard(recipe, index, "favorites")).join("")}
      </div>
    </section>`;
}

function catalogCuisines() {
  return [...new Set(catalogRecipes.map((recipe) => String(recipe.cuisine || "Другая кухня")))].sort((a, b) => {
    if (a === "Россия") return -1;
    if (b === "Россия") return 1;
    return a.localeCompare(b, "ru");
  });
}

function cuisineLabel(cuisine) {
  const flag = catalogRecipes.find((recipe) => recipe.cuisine === cuisine)?.flag || "🌍";
  return `${flag} ${cuisine}`;
}

function filteredCatalogRecipes() {
  const query = normalize(catalogQuery);
  return catalogRecipes.filter((recipe) => {
    const cuisineMatches = catalogCuisine === "все" || recipe.cuisine === catalogCuisine;
    const difficultyMatches = catalogDifficulty === "все" || difficultyValue(recipe.difficulty) === catalogDifficulty;
    const courseMatches = catalogCourse === "все" || recipe.course === catalogCourse;
    const proteinMatches = catalogProtein === "все" || recipe.protein === catalogProtein;
    const missingCount = catalogMissingIngredients(recipe).length;
    const availabilityMatches = catalogAvailability === "все"
      || (catalogAvailability === "ready" && missingCount === 0)
      || (catalogAvailability === "one" && missingCount === 1);
    const timeMatches = !catalogMaxMinutes || Number(recipe.minutes) <= catalogMaxMinutes;
    const searchable = [recipe.title, recipe.subtitle, recipe.cuisine, ...(recipe.ingredients || []).map((item) => item.name)].join(" ");
    return cuisineMatches && difficultyMatches && courseMatches && proteinMatches && availabilityMatches && timeMatches && (!query || normalize(searchable).includes(query));
  });
}

function orderCatalogRecipes(recipesToOrder) {
  return [...recipesToOrder].sort((first, second) => Number(first.course === "соус") - Number(second.course === "соус")
    || catalogMissingIngredients(first).length - catalogMissingIngredients(second).length
    || recipePriorityScore(second) - recipePriorityScore(first));
}

function renderCatalogCard(recipe, index) {
  const favorite = isFavorite(recipe);
  const missing = catalogMissingIngredients(recipe);
  const ingredients = (recipe.ingredients || []).slice(0, 5).map((item) => escapeHtml(item.name));
  return `<article class="catalog-card">
    <div class="catalog-card-index">${String(index + 1).padStart(2, "0")}</div>
    <div class="catalog-card-topline">
      <span>${escapeHtml(`${recipe.flag || "🌍"} ${recipe.cuisine || "Мировая кухня"}`)}</span>
      <button class="favorite-toggle ${favorite ? "active" : ""}" data-toggle-favorite-source="catalog" data-recipe-index="${index}" aria-label="${favorite ? "Убрать из избранного" : "Сохранить в избранное"}">${favorite ? "♥" : "♡"}</button>
    </div>
    ${state.ingredients.length ? `<div class="catalog-availability ${missing.length === 0 ? "ready" : missing.length === 1 ? "one" : "many"}">${missing.length === 0 ? "Можно приготовить сейчас" : missing.length === 1 ? `Не хватает: ${escapeHtml(missing[0])}` : `Не хватает продуктов: ${missing.length}`}</div>` : ""}
    <h3><button data-open-recipe="${index}" data-recipe-source="catalog">${escapeHtml(recipe.title)}</button></h3>
    <p>${escapeHtml(recipe.subtitle || "Классический рецепт")}</p>
    <div class="catalog-card-meta"><span>${escapeHtml(recipe.course || "основное")}</span><span>${escapeHtml(recipe.protein || "без мяса")}</span><span>${Number(recipe.minutes) || 30} мин</span><span>${escapeHtml(recipe.difficulty || "легко")}</span><span>≈ ${Number(recipe.nutrition?.calories) || 0} ккал</span></div>
    <p class="catalog-ingredients">${ingredients.join(" · ")}${(recipe.ingredients || []).length > 5 ? " · …" : ""}</p>
    <button class="catalog-open" data-open-recipe="${index}" data-recipe-source="catalog">Открыть рецепт <span>→</span></button>
  </article>`;
}

function updateCatalogResults() {
  const count = document.querySelector(".catalog-count");
  const grid = document.querySelector(".catalog-grid");
  if (!count || !grid) return;
  const filtered = orderCatalogRecipes(filteredCatalogRecipes());
  count.textContent = `Найдено — ${filtered.length.toString().padStart(2, "0")}`;
  grid.innerHTML = filtered.length
    ? filtered.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("")
    : `<p class="catalog-empty">Ничего не нашлось. Попробуйте убрать один из фильтров.</p>`;
}

function activateCatalogFilter(target) {
  target.parentElement?.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button === target);
  });
  updateCatalogResults();
}

function renderCatalogView() {
  if (catalogLoading) return `<section class="archive-page"><div class="archive-heading"><p class="eyebrow">Редакционная коллекция</p><h1>База<br>рецептов</h1>${renderPotLoader("pot-loader-large")}</div></section>`;
  if (catalogError) return `<section class="archive-page"><div class="archive-heading"><p class="eyebrow">Редакционная коллекция</p><h1>База<br>рецептов</h1><p>${escapeHtml(catalogError)}</p><button class="archive-retry" data-action="load-catalog">Попробовать ещё раз</button></div></section>`;
  const filtered = orderCatalogRecipes(filteredCatalogRecipes());
  return `<section class="archive-page" aria-labelledby="catalog-title">
    <header class="archive-heading">
      <div><p class="eyebrow">Редакционная коллекция / ${catalogRecipes.length.toString().padStart(2, "0")}</p><h1 id="catalog-title">База<br>рецептов</h1></div>
      <div class="archive-visual">
        <p>Известные блюда разных стран в традиционной формуле — без случайных замен и выдуманных шагов.</p>
        <figure class="section-illustration base-illustration" aria-hidden="true">
          <img src="/illustrations/base-hero.webp" alt="">
        </figure>
      </div>
    </header>
    <div class="catalog-tools">
      <label class="catalog-search"><span>Поиск</span><input data-catalog-search value="${escapeHtml(catalogQuery)}" placeholder="Блюдо, кухня или продукт"></label>
      <div class="catalog-filter"><span>Сложность</span><div>${["все", "легко", "обычно", "сложно"].map((value) => `<button class="${catalogDifficulty === value ? "active" : ""}" data-catalog-difficulty="${value}">${value}</button>`).join("")}</div></div>
      <div class="catalog-filter"><span>Блюдо</span><div>${["все", "суп", "основное", "салат", "закуска", "завтрак", "выпечка", "соус"].map((value) => `<button class="${catalogCourse === value ? "active" : ""}" data-catalog-course="${value}">${value}</button>`).join("")}</div></div>
      <div class="catalog-filter"><span>Состав</span><div>${["все", "мясо", "рыба и морепродукты", "без мяса"].map((value) => `<button class="${catalogProtein === value ? "active" : ""}" data-catalog-protein="${value}">${value === "мясо" ? "с мясом" : value}</button>`).join("")}</div></div>
      <div class="catalog-filter"><span>Мои продукты</span><div>${[["все", "все"], ["ready", "всё есть"], ["one", "не хватает 1"]].map(([value, label]) => `<button class="${catalogAvailability === value ? "active" : ""}" data-catalog-availability="${value}">${label}</button>`).join("")}</div></div>
      <div class="catalog-filter"><span>Время</span><div>${[[0, "любое"], [15, "до 15 мин"], [30, "до 30 мин"], [60, "до часа"]].map(([value, label]) => `<button class="${catalogMaxMinutes === value ? "active" : ""}" data-catalog-max-minutes="${value}">${label}</button>`).join("")}</div></div>
      <div class="catalog-filter cuisine-filter"><span>Страна</span><div><button class="${catalogCuisine === "все" ? "active" : ""}" data-catalog-cuisine="все">все</button>${catalogCuisines().map((value) => `<button class="${catalogCuisine === value ? "active" : ""}" data-catalog-cuisine="${escapeHtml(value)}">${escapeHtml(cuisineLabel(value))}</button>`).join("")}</div></div>
    </div>
    <div class="catalog-count">Найдено — ${filtered.length.toString().padStart(2, "0")}</div>
    <div class="catalog-grid">${filtered.length ? filtered.map((recipe) => renderCatalogCard(recipe, catalogRecipes.indexOf(recipe))).join("") : `<p class="catalog-empty">Ничего не нашлось. Попробуйте убрать один из фильтров.</p>`}</div>
  </section>`;
}

function renderSwipeCard(recipe, position = "front") {
  const favorite = isFavorite(recipe);
  return `<article class="swipe-card ${position} ${position === "front" && swipeHintPending ? "swipe-hint" : ""}" data-swipe-card ${position === "front" ? "tabindex=\"0\"" : "aria-hidden=\"true\""}>
    <div class="swipe-stamp swipe-stamp-no">Пропустить</div>
    <div class="swipe-stamp swipe-stamp-yes">В избранное</div>
    <div class="swipe-card-counter">${String(swipeIndex + 1).padStart(2, "0")} / ${swipeRecipes.length.toString().padStart(2, "0")}</div>
    <p class="swipe-cuisine">${escapeHtml(`${recipe.flag || "🌍"} ${recipe.cuisine || "Мировая кухня"}`)}</p>
    <h2><button data-open-recipe="${catalogRecipes.indexOf(recipe)}" data-recipe-source="catalog">${escapeHtml(recipe.title)}</button></h2>
    <p class="swipe-subtitle">${escapeHtml(recipe.subtitle || "Классический рецепт")}</p>
    <div class="swipe-meta"><span>${escapeHtml(recipe.course || "основное")}</span><span>${escapeHtml(recipe.protein || "без мяса")}</span><span>${Number(recipe.minutes) || 30} мин</span><span>${escapeHtml(recipe.difficulty || "легко")}</span><span>≈ ${Number(recipe.nutrition?.calories) || 0} ккал</span></div>
    <div class="swipe-ingredients"><span>Главное</span><p>${(recipe.ingredients || []).slice(0, 6).map((item) => escapeHtml(item.name)).join(", ")}</p></div>
    ${favorite ? `<div class="swipe-saved">Уже в избранном ♥</div>` : ""}
  </article>`;
}

function renderSwipeView() {
  if (catalogLoading) return `<section class="swipe-page"><div class="swipe-heading"><p class="eyebrow">Выбирать можно быстрее</p><h1>АМ <span class="am-heart">❤️</span></h1>${renderPotLoader("pot-loader-large")}</div></section>`;
  if (catalogError) return `<section class="swipe-page"><div class="swipe-heading"><p class="eyebrow">Выбирать можно быстрее</p><h1>АМ <span class="am-heart">❤️</span></h1><button class="archive-retry" data-action="load-catalog">Попробовать ещё раз</button></div></section>`;
  const recipe = swipeRecipes[swipeIndex];
  const nextRecipe = swipeRecipes[swipeIndex + 1];
  return `<section class="swipe-page" aria-labelledby="swipe-title">
    <header class="swipe-heading">
      <p class="eyebrow">Влево — пропустить · вправо — сохранить</p>
      <h1 id="swipe-title">АМ <span class="am-heart">❤️</span></h1>
      <p>${state.ingredients.length ? "Сначала показываем блюда, которые подходят к вашим продуктам и настройкам кухни." : "Можно нажимать кнопки снизу. Название открывает полный рецепт."}</p>
      <figure class="section-illustration swipe-illustration" aria-hidden="true">
        <img src="/illustrations/am-heart-hero.webp" alt="">
      </figure>
    </header>
    <div class="swipe-stage">
      ${recipe ? `${nextRecipe ? renderSwipeCard(nextRecipe, "behind") : ""}${renderSwipeCard(recipe)}` : `<div class="swipe-finished"><span>Колода закончилась</span><h2>Вы посмотрели все рецепты</h2><p>Сохранённые блюда уже лежат в избранном. Пропущенные можно вернуть.</p><button data-action="restart-swipe">Показать заново</button></div>`}
    </div>
    ${recipe ? `<div class="swipe-controls"><button class="swipe-no" data-swipe="left" aria-label="Пропустить рецепт"><span>←</span> Пропустить</button><button class="swipe-yes" data-swipe="right" aria-label="Добавить рецепт в избранное">Сохранить <span>♥</span></button></div>` : ""}
  </section>`;
}

function renderFavoritesView() {
  if (favoriteRecipes.length) return renderFavorites();
  return `<section class="favorites-empty">
    <div class="favorites-copy">
      <p class="eyebrow">Личная коллекция</p>
      <h1>Пока<br>пусто</h1>
      <p>Смахните рецепт вправо в разделе «АМ ❤️» или нажмите сердечко в базе.</p>
      <button data-view="swipe">Открыть АМ ❤️ <span>→</span></button>
    </div>
    <figure class="section-illustration favorites-illustration" aria-hidden="true">
      <img src="/illustrations/favorites-hero.webp" alt="">
    </figure>
  </section>`;
}

function resetSwipeDeck() {
  const skippedIds = new Set(swipeHistory.filter((item) => item?.action === "skip").map((item) => item.id));
  const maxMissing = state.searchMode === "plus-one" ? 1 : 0;
  const base = catalogRecipes.filter((recipe) => recipe.course !== "соус")
    .filter((recipe) => !state.maxMinutes || Number(recipe.minutes) <= Number(state.maxMinutes))
    .filter((recipe) => state.course === "все" || recipe.course === state.course || (state.course === "перекус" && ["закуска", "салат"].includes(recipe.course)))
    .filter((recipe) => !skippedIds.has(recipeId(recipe)));
  const matched = state.ingredients.length ? base.filter((recipe) => catalogMissingIngredients(recipe).length <= maxMissing) : base;
  swipeRecipes = matched.length ? matched : base;
  const random = new Uint32Array(1);
  for (let index = swipeRecipes.length - 1; index > 0; index -= 1) {
    crypto.getRandomValues(random);
    const target = random[0] % (index + 1);
    [swipeRecipes[index], swipeRecipes[target]] = [swipeRecipes[target], swipeRecipes[index]];
  }
  swipeRecipes.sort((first, second) => {
    const firstRecord = cookingRecord(first);
    const secondRecord = cookingRecord(second);
    const score = (recipe, record) => recipePriorityScore(recipe) * 20
      - catalogMissingIngredients(recipe).length * 8
      + Number(difficultyValue(recipe.difficulty) === state.difficulty) * 4
      + Number(record?.rating === "liked") * 12
      - Number(record?.rating === "disliked") * 40;
    return score(second, secondRecord) - score(first, firstRecord);
  });
  swipeIndex = 0;
}

async function loadCatalog(force = false) {
  if ((catalogRecipes.length && !force) || catalogLoading) return;
  catalogLoading = true;
  catalogError = "";
  render();
  try {
    const response = await fetch(`/api/catalog?portions=${state.portions}`);
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.recipes)) throw new Error(data.error || "Не удалось открыть базу рецептов");
    catalogRecipes = orderCatalogRecipes(data.recipes);
    resetSwipeDeck();
  } catch (error) {
    catalogError = error instanceof Error ? error.message : "Не удалось открыть базу рецептов";
  } finally {
    catalogLoading = false;
    render();
  }
}

function selectRecipeSource(source) {
  if (source === "favorites") return favoriteRecipes;
  if (source === "catalog") return catalogRecipes;
  return recipes;
}

function setView(view) {
  if (!["kitchen", "catalog", "swipe", "favorites"].includes(view)) return;
  if (currentView === view) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  currentView = view;
  if (view === "swipe") {
    if (catalogRecipes.length && !swipeRecipes.length) resetSwipeDeck();
    swipeHintPending = true;
  }
  history.replaceState(null, "", view === "kitchen" ? `${location.pathname}${location.search}` : `#${view}`);
  render({ preserveScroll: false });
  restorePageScroll(0);
  if ((view === "catalog" || view === "swipe") && !catalogRecipes.length) loadCatalog();
}

function finishSwipe(direction) {
  if (swipeBusy || !swipeRecipes[swipeIndex]) return;
  swipeBusy = true;
  const card = document.querySelector(".swipe-card.front");
  const nextCard = document.querySelector(".swipe-card.behind");
  card?.classList.add(direction === "right" ? "fly-right" : "fly-left");
  nextCard?.classList.add("promoting");
  const recipe = swipeRecipes[swipeIndex];
  window.setTimeout(() => {
    swipeIndex += 1;
    swipeBusy = false;
    swipeHistory = [{ id: recipeId(recipe), action: direction === "right" ? "save" : "skip", at: Date.now() }, ...swipeHistory.filter((item) => item.id !== recipeId(recipe))];
    saveSwipeHistory();
    if (direction === "right" && !isFavorite(recipe)) toggleFavorite(recipe);
    else render();
  }, 340);
}

function renderRecipeCard(recipe, index, source = "recipes") {
  const uses = Array.isArray(recipe.uses) ? recipe.uses : [];
  const missing = Array.isArray(recipe.missing) ? recipe.missing.filter(Boolean) : [];
  const favorite = isFavorite(recipe);
  const calories = Number(recipe.nutrition?.calories) || 0;
  const subtitle = String(recipe.subtitle || recipe.why || "").trim();
  const why = String(recipe.why || "").trim();
  const comparable = (value) => normalize(value).replace(/[^а-яa-z0-9]+/gu, " ").trim();
  const showWhy = why && comparable(why) !== comparable(subtitle);
  const generatedByAi = recipe.source?.type === "generated";
  return `
    <article class="recipe-entry">
      <div class="recipe-number">${String(index + 1).padStart(2, "0")}</div>
      <div class="recipe-main">
        <div class="recipe-card-topline">
          <div class="recipe-badges">
            <div class="recipe-status ${missing.length ? "needs-one" : "complete"}">${missing.length ? `Докупить: ${escapeHtml(missing.join(", "))}` : "Все продукты есть"}</div>
            ${generatedByAi ? `<span class="recipe-ai-label">Сгенерировано ИИ</span>` : ""}
          </div>
          <button class="favorite-toggle ${favorite ? "active" : ""}" data-toggle-favorite-source="${source}" data-recipe-index="${index}" aria-pressed="${favorite}" aria-label="${favorite ? "Убрать из избранного" : "Сохранить в избранное"}">${favorite ? "♥" : "♡"}</button>
        </div>
        <h3><button class="recipe-title-button" data-open-recipe="${index}" data-recipe-source="${source}">${escapeHtml(recipe.title)}</button></h3>
        ${subtitle ? `<p class="recipe-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        <div class="recipe-meta">
          <span>${Number(recipe.minutes) || 30} мин</span>
          <span>${escapeHtml(recipe.difficulty || "просто")}</span>
          ${calories ? `<span>≈ ${calories} ккал</span>` : ""}
          <span>${missing.length ? "Нужна 1 покупка" : "Без покупок"}</span>
        </div>
      </div>
      <div class="recipe-side">
        ${showWhy ? `<p>${escapeHtml(why)}</p>` : ""}
        ${uses.length ? `<p class="uses-line">Используем: ${uses.map(escapeHtml).join(", ")}</p>` : ""}
        <button class="open-recipe" data-open-recipe="${index}" data-recipe-source="${source}">Открыть рецепт <span aria-hidden="true">→</span></button>
      </div>
    </article>`;
}

function renderAuthOverlay() {
  if (authUser) {
    return `<div class="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <button class="overlay-backdrop" data-action="close-auth" aria-label="Закрыть"></button>
      <section class="auth-card account-card">
        <button class="auth-close" data-action="close-auth" aria-label="Закрыть">×</button>
        <p class="eyebrow">Ваш профиль</p>
        <h2 id="account-title">${escapeHtml(authUser.name)}</h2>
        <p class="auth-lead">${escapeHtml(authUser.email)}</p>
        <p class="account-summary">Сохранено продуктов: ${state.ingredients.length}<br>Возможностей кухни: ${state.equipment.length}<br>Рецептов в избранном: ${favoriteRecipes.length}</p>
        <button class="auth-primary" data-action="close-auth">Продолжить готовить</button>
        <button class="auth-secondary" data-action="logout">Выйти из аккаунта</button>
      </section>
    </div>`;
  }

  return `<div class="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="account-title">
    <button class="overlay-backdrop" data-action="close-auth" aria-label="Закрыть"></button>
    <section class="auth-card">
      <button class="auth-close" data-action="close-auth" aria-label="Закрыть">×</button>
      <p class="eyebrow">Один аккаунт для всей кухни</p>
      <h2 id="account-title">Войти в Кутно</h2>
      <p class="auth-lead">Продукты и инвентарь будут доступны на телефоне и компьютере.</p>
      <div class="google-signin-wrap">
        <div id="google-signin-button" aria-live="polite">${authBusy ? "Проверяем аккаунт…" : "Загружаем Google…"}</div>
      </div>
      ${authError ? `<p class="auth-error" role="alert">${escapeHtml(authError)}</p>` : ""}
      <p class="google-auth-note">Google передаст Кутно только имя, адрес почты и идентификатор аккаунта. Пароль Google остаётся у Google.</p>
    </section>
  </div>`;
}

function renderClearProductsConfirmation() {
  return `<div class="auth-overlay confirm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="clear-products-title" aria-describedby="clear-products-description">
    <button class="overlay-backdrop" data-action="cancel-clear-products" aria-label="Отменить очистку"></button>
    <section class="auth-card confirm-card">
      <p class="eyebrow">Очистить список</p>
      <h2 id="clear-products-title">Удалить все продукты?</h2>
      <p id="clear-products-description" class="auth-lead">Техника, сложность, порции и избранное останутся без изменений.</p>
      <div class="confirm-actions">
        <button class="auth-secondary" data-action="cancel-clear-products">Отмена</button>
        <button class="auth-primary" data-action="confirm-clear-products">Очистить продукты</button>
      </div>
    </section>
  </div>`;
}

function stepTimerMinutes(step = "") {
  const values = [...String(step).matchAll(/(\d+)\s*(?:–|-|—)?\s*(\d+)?\s*мин/giu)]
    .map((match) => Number(match[2] || match[1]))
    .filter((value) => value > 0 && value <= 180);
  return values[0] || 0;
}

function timerLabel() {
  if (!cookingTimerEndsAt) return "";
  const remaining = Math.max(0, Math.ceil((cookingTimerEndsAt - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function stopCookingTimer() {
  clearInterval(cookingTimerInterval);
  cookingTimerInterval = null;
  cookingTimerEndsAt = 0;
  cookingTimer = null;
}

function startCookingTimer(minutes) {
  stopCookingTimer();
  cookingTimer = minutes;
  cookingTimerEndsAt = Date.now() + minutes * 60 * 1000;
  const update = () => {
    const output = document.querySelector("[data-cooking-timer-output]");
    if (output) output.textContent = timerLabel();
    if (cookingTimerEndsAt && Date.now() >= cookingTimerEndsAt) {
      stopCookingTimer();
      if (output) output.textContent = "Готово";
      navigator.vibrate?.([120, 80, 120]);
    }
  };
  update();
  cookingTimerInterval = setInterval(update, 1000);
}

async function setCookingMode(enabled) {
  cookingMode = enabled;
  cookingStep = 0;
  stopCookingTimer();
  if (enabled) {
    try {
      cookingWakeLock = await navigator.wakeLock?.request("screen");
    } catch {
      cookingWakeLock = null;
    }
  } else {
    await cookingWakeLock?.release?.().catch(() => {});
    cookingWakeLock = null;
  }
  render();
}

function finishCooking(recipe) {
  const id = recipeId(recipe);
  cookingHistory = [{ id, title: recipe.title, cookedAt: Date.now(), rating: cookingRecord(recipe)?.rating || "" }, ...cookingHistory.filter((item) => item.id !== id)];
  saveCookingHistory();
  cookingMode = false;
  stopCookingTimer();
  cookingWakeLock?.release?.().catch(() => {});
  cookingWakeLock = null;
  render();
}

function rateCookedRecipe(recipe, rating) {
  const id = recipeId(recipe);
  const previous = cookingRecord(recipe) || { id, title: recipe.title, cookedAt: Date.now() };
  cookingHistory = [{ ...previous, rating }, ...cookingHistory.filter((item) => item.id !== id)];
  saveCookingHistory();
  render();
}

function renderRecipeOverlay(recipe) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = (Array.isArray(recipe.steps) ? recipe.steps : [])
    .filter((step) => typeof step === "string")
    .map((step) => step.trim())
    .filter((step) => step && !/^(?:(?:sub)?title|description|step\s*\d*|шаг\s*\d*|null|undefined)$/i.test(step));
  const nutrition = recipe.nutrition || {};
  const favorite = isFavorite(recipe);
  const portions = Number(recipe.portions) || state.portions;
  const cooked = cookingRecord(recipe);
  const currentStepText = steps[Math.min(cookingStep, Math.max(0, steps.length - 1))] || "";
  const currentTimerMinutes = stepTimerMinutes(currentStepText);
  return `
    <div class="recipe-overlay" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
      <button class="overlay-backdrop" data-action="close-recipe" aria-label="Закрыть рецепт"></button>
      <article class="recipe-sheet">
        <div class="sheet-topline">
          <span>Кутно / рецепт</span>
          <div class="sheet-actions">
            <button class="sheet-cook ${cookingMode ? "active" : ""}" data-action="${cookingMode ? "stop-cooking" : "start-cooking"}">${cookingMode ? "Весь рецепт" : "Готовить"}</button>
            <button class="sheet-favorite ${favorite ? "active" : ""}" data-toggle-active-favorite aria-pressed="${favorite}">${favorite ? "В избранном ♥" : "В избранное ♡"}</button>
            <button class="sheet-close" data-action="close-recipe">Закрыть ×</button>
          </div>
        </div>
        <header class="sheet-header">
          <p>${escapeHtml(recipe.subtitle || "Рецепт из того, что есть")}</p>
          <h2 id="recipe-title">${escapeHtml(recipe.title)}</h2>
          <div class="sheet-meta">${recipe.cuisine ? `<span>${escapeHtml(`${recipe.flag || "🌍"} ${recipe.cuisine}`)}</span>` : ""}${recipe.course ? `<span>${escapeHtml(recipe.course)}</span>` : ""}${recipe.protein ? `<span>${escapeHtml(recipe.protein)}</span>` : ""}<span>${recipe.minutes} мин</span><span>${portions} порции</span><span>${escapeHtml(recipe.difficulty || "просто")}</span></div>
        </header>
        ${Number(nutrition.calories) ? `<section class="nutrition-block" aria-labelledby="nutrition-title">
          <div class="nutrition-heading">
            <h3 id="nutrition-title">КБЖУ на порцию</h3>
            <span>ориентировочно</span>
          </div>
          <div class="nutrition-grid">
            <div><b>${Math.round(Number(nutrition.calories))}</b><span>ккал</span></div>
            <div><b>${Number(nutrition.protein || 0).toFixed(1)}</b><span>белки, г</span></div>
            <div><b>${Number(nutrition.fat || 0).toFixed(1)}</b><span>жиры, г</span></div>
            <div><b>${Number(nutrition.carbs || 0).toFixed(1)}</b><span>углеводы, г</span></div>
          </div>
        </section>` : ""}
        ${cookingMode ? `<section class="cooking-mode" aria-live="polite">
          <div class="cooking-progress"><span>Шаг ${cookingStep + 1} из ${steps.length}</span><progress value="${cookingStep + 1}" max="${steps.length}"></progress></div>
          <p class="cooking-step">${escapeHtml(currentStepText)}</p>
          ${currentTimerMinutes ? `<div class="cooking-timer">
            <button data-action="start-step-timer" data-timer-minutes="${currentTimerMinutes}">${cookingTimerEndsAt ? "Перезапустить таймер" : `Таймер · ${currentTimerMinutes} мин`}</button>
            <output data-cooking-timer-output>${timerLabel()}</output>
          </div>` : ""}
          <div class="cooking-controls">
            <button data-action="previous-cooking-step" ${cookingStep === 0 ? "disabled" : ""}>← Назад</button>
            ${cookingStep < steps.length - 1 ? `<button class="primary" data-action="next-cooking-step">Дальше →</button>` : `<button class="primary" data-action="finish-cooking">Блюдо готово</button>`}
          </div>
          <p class="cooking-wake-note">Пока открыт режим готовки, экран не будет гаснуть, если браузер поддерживает эту функцию.</p>
        </section>` : `<div class="sheet-grid">
          <section>
            <h3>Что понадобится</h3>
            <ol class="ingredient-ledger">
              ${ingredients.map((item) => `<li class="${item.info ? "has-ingredient-info" : ""}">
                ${item.info ? `<details class="ingredient-info"><summary><span class="ingredient-info-name">${escapeHtml(item.name)}</span><span class="ingredient-info-icon" aria-hidden="true">ⓘ</span></summary><div><p>${escapeHtml(item.info.description || "")}</p><p><b>Чем заменить:</b> ${escapeHtml(item.info.substitutes || "Точной замены нет.")}</p></div></details>` : `<span>${escapeHtml(item.name)}</span>`}
                <b>${escapeHtml(item.amount)}</b>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
              </li>`).join("")}
            </ol>
            ${recipe.equipment?.length ? `<p class="sheet-equipment">Инвентарь — ${recipe.equipment.map(escapeHtml).join(", ")}</p>` : ""}
          </section>
          <section>
            <h3>Как готовить</h3>
            <ol class="steps-list">
              ${steps.map((step, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(step)}</p></li>`).join("")}
            </ol>
            ${recipe.tip ? `<aside class="cook-note"><span>На заметку</span><p>${escapeHtml(recipe.tip)}</p></aside>` : ""}
          </section>
        </div>`}
        ${cooked ? `<section class="cooked-feedback"><span>Готовили ${new Date(cooked.cookedAt).toLocaleDateString("ru-RU")}</span><div><button class="${cooked.rating === "liked" ? "active" : ""}" data-rate-recipe="liked">Понравилось</button><button class="${cooked.rating === "disliked" ? "active" : ""}" data-rate-recipe="disliked">Не моё</button></div></section>` : ""}
        <p class="recipe-source-note">
          ${recipe.source?.type === "generated" ? `<strong class="recipe-ai-source">Сгенерировано ИИ.</strong> ` : ""}
          ${recipe.source?.url ? `<a href="${escapeHtml(recipe.source.url)}" target="_blank" rel="noopener noreferrer">Источник — ${escapeHtml(recipe.source.name || "Spoonacular")}</a>. ` : ""}
          ${escapeHtml(recipe.source?.note || "Рецепт проверен по вашему списку продуктов")}${recipe.nutrition?.checked ? ". КБЖУ на порцию проверено по энергетическому балансу белков, жиров и углеводов" : ". КБЖУ рассчитано приблизительно"}.
          <a class="recipe-report" href="https://t.me/oskrenh" target="_blank" rel="noopener noreferrer">Сообщить об ошибке</a>.
        </p>
      </article>
    </div>`;
}

function addIngredients(values) {
  const next = values
    .flatMap((value) => value.split(/[,;\n]+/))
    .map(normalize)
    .filter(Boolean);
  state.ingredients = [...new Set([...state.ingredients, ...next])];
  recentRecipeTitles = [];
  recentSourceIds = [];
  recipes = [];
  saveState();
  render();
}

const fallbackNutrition = {
  "Жареный рис с яйцом": { calories: 385, protein: 13, fat: 12, carbs: 57, estimated: true },
  "Картофельная тортилья": { calories: 430, protein: 15, fat: 24, carbs: 38, estimated: true },
  "Курица с рисом": { calories: 545, protein: 39, fat: 15, carbs: 64, estimated: true },
  "Паста с чесноком и сыром": { calories: 480, protein: 18, fat: 19, carbs: 59, estimated: true },
  "Шакшука": { calories: 245, protein: 12, fat: 15, carbs: 15, estimated: true },
  "Гречка с грибами": { calories: 390, protein: 12, fat: 12, carbs: 61, estimated: true },
  "Яичница": { calories: 250, protein: 19, fat: 19, carbs: 1, estimated: true },
  "Отварные яйца": { calories: 215, protein: 19, fat: 15, carbs: 1, estimated: true },
  "Жареный картофель": { calories: 360, protein: 6, fat: 14, carbs: 53, estimated: true },
  "Рассыпчатый рис": { calories: 325, protein: 6, fat: 1, carbs: 72, estimated: true },
  "Макароны с маслом": { calories: 430, protein: 12, fat: 10, carbs: 72, estimated: true },
};

function getFallbackSuggestions() {
  const have = state.ingredients.map(normalize);
  const availableEquipment = state.equipment.map(equipmentName);
  const knownEquipment = new Set(equipmentOptions.map(([, name]) => name));
  const maxMissing = state.searchMode === "plus-one" ? 1 : 0;
  const ingredientIsAvailable = (name, missing = []) => {
    const value = normalize(name);
    if (["соль", "вода", "масло"].some((basic) => value.includes(basic))) return true;
    return have.some((owned) => value.includes(owned) || owned.includes(value))
      || missing.some((item) => value.includes(item) || item.includes(value));
  };
  const scored = fallbackRecipes.map((recipe) => {
    const uses = recipe.required.filter((item) => have.some((owned) => owned.includes(item) || item.includes(owned)));
    const missing = recipe.required.filter((item) => !uses.includes(item));
    const match = Math.round((uses.length / recipe.required.length) * 100);
    return scaledFallbackRecipe({
      ...recipe,
      uses,
      missing,
      match,
      nutrition: fallbackNutrition[recipe.title],
      source: {
        name: "Кутно",
        type: "curated",
        note: "Рецепт из проверенной базовой коллекции Кутно",
      },
    }, state.portions);
  });
  return scored
    .filter((item) => item.missing.length <= maxMissing && item.ingredients.every((ingredient) => ingredientIsAvailable(ingredient.name, item.missing)))
    .filter((item) => !state.maxMinutes || item.minutes <= state.maxMinutes)
    .filter((item) => state.course === "все" || item.course === state.course || (state.course === "перекус" && ["закуска", "салат"].includes(item.course)))
    .filter((item) => item.equipment.filter((name) => knownEquipment.has(name)).every((name) => availableEquipment.includes(name)))
    .sort((a, b) => Number(difficultyValue(a.difficulty) === state.difficulty) * -1
      - Number(difficultyValue(b.difficulty) === state.difficulty) * -1
      || recipePriorityScore(b) - recipePriorityScore(a) || b.match - a.match || a.minutes - b.minutes)
    .slice(0, 3);
}

const RECIPE_TITLE_FILLER_WORDS = new Set([
  "а", "без", "в", "для", "и", "из", "на", "от", "по", "под", "с", "со",
  "быстрая", "быстрое", "быстрые", "быстрый", "домашняя", "домашнее", "домашние", "домашний",
  "классическая", "классическое", "классические", "классический",
  "китайская", "китайское", "китайские", "китайский", "простая", "простое", "простые", "простой",
  "традиционная", "традиционное", "традиционные", "традиционный",
]);

function recipeTitleTokens(value = "") {
  return normalize(String(value || "")).replace(/[^а-яa-z0-9]+/gu, " ").trim().split(" ")
    .filter((word) => word && !RECIPE_TITLE_FILLER_WORDS.has(word))
    .map((word) => word.length <= 3 ? word : word.replace(/(?:иями|ями|ами|его|ого|ему|ому|ыми|ими|ой|ый|ий|ая|яя|ое|ее|ые|ие|ую|юю|ов|ев|ам|ям|ах|ях|ом|ем|у|ю|а|я|ы|и|е|о)$/u, ""))
    .filter((word) => word.length >= 2);
}

function recipeTitlesAreDuplicate(firstTitle = "", secondTitle = "") {
  const firstSignature = normalize(String(firstTitle || "")).replace(/[^а-яa-z0-9]+/gu, " ").trim();
  const secondSignature = normalize(String(secondTitle || "")).replace(/[^а-яa-z0-9]+/gu, " ").trim();
  if (!firstSignature || !secondSignature) return false;
  if (firstSignature === secondSignature) return true;
  const first = [...new Set(recipeTitleTokens(firstTitle))];
  const second = [...new Set(recipeTitleTokens(secondTitle))];
  if (!first.length || !second.length) return false;
  if (first.join(" ") === second.join(" ")) return true;
  const secondSet = new Set(second);
  const shared = first.filter((token) => secondSet.has(token)).length;
  const shorter = Math.min(first.length, second.length);
  const union = new Set([...first, ...second]).size;
  return shorter >= 2 && shared / shorter >= 0.85 && shared / union >= 0.65;
}

function mergeUniqueRecipes(primary, additions, excludedTitles = [], limit = 3) {
  const unique = [];
  for (const recipe of [...primary, ...additions]) {
    if (!recipe?.title) continue;
    const isPrimary = primary.includes(recipe);
    if (!isPrimary && excludedTitles.some((title) => recipeTitlesAreDuplicate(title, recipe.title))) continue;
    if (unique.some((existing) => recipeTitlesAreDuplicate(existing.title, recipe.title))) continue;
    unique.push(recipe);
    if (unique.length === limit) break;
  }
  return unique;
}

async function generateRecipes({ append = false } = {}) {
  if (!state.ingredients.length || isLoading || isLoadingMore) return;
  const instantFallbacks = append ? [] : getFallbackSuggestions();
  const existingRecipes = append ? [...recipes] : instantFallbacks;
  const excludeTitles = [...new Set([...recentRecipeTitles, ...recipes.map((recipe) => recipe.title).filter(Boolean)])].slice(-12);
  const excludeSourceIds = [...new Set([...recentSourceIds, ...recipes.map((recipe) => Number(recipe.source?.id)).filter(Number.isFinite)])].slice(-20);
  if (append) isLoadingMore = true;
  else {
    recipes = instantFallbacks;
    isLoading = instantFallbacks.length === 0;
    isLoadingMore = instantFallbacks.length > 0;
  }
  generationError = "";
  loadMoreMessage = "";
  render();

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ingredients: state.ingredients,
        equipment: state.equipment.map(equipmentName),
        difficulty: state.difficulty,
        portions: state.portions,
        searchMode: state.searchMode,
        maxMinutes: state.maxMinutes,
        course: state.course,
        priorityIngredients: state.priorityIngredients,
        excludeTitles,
        excludeSourceIds,
        variation: Date.now() % 1000000,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Не удалось составить меню");
    }
    const data = await response.json();
    if (!Array.isArray(data.recipes)) throw new Error("Не найдено подходящих вариантов");
    const incoming = mergeUniqueRecipes(data.recipes, getFallbackSuggestions(), excludeTitles);
    if (append) {
      recipes = mergeUniqueRecipes(existingRecipes, incoming, [], existingRecipes.length + 3);
      if (recipes.length === existingRecipes.length) loadMoreMessage = "Для этого набора больше надёжных вариантов нет";
    } else {
      recipes = mergeUniqueRecipes(existingRecipes, incoming, [], 3);
    }
    hasMoreRecipes = Boolean(data.hasMore) && recipes.length > 0;
    if (!recipes.length) generationError = data.error || "Добавьте ещё один основной продукт или измените настройки";
    recentRecipeTitles = [...new Set([...excludeTitles, ...recipes.map((recipe) => recipe.title).filter(Boolean)])].slice(-24);
    recentSourceIds = [...new Set([...excludeSourceIds, ...recipes.map((recipe) => Number(recipe.source?.id)).filter(Number.isFinite)])].slice(-20);
  } catch (error) {
    const safeFallbacks = getFallbackSuggestions();
    if (append) {
      recipes = mergeUniqueRecipes(existingRecipes, safeFallbacks, excludeTitles, existingRecipes.length + 3);
      loadMoreMessage = recipes.length > existingRecipes.length ? "" : "Для этого набора больше надёжных вариантов нет";
    } else {
      recipes = mergeUniqueRecipes(existingRecipes, safeFallbacks, [], 3);
    }
    hasMoreRecipes = false;
    if (!append && !recipes.length) {
      generationError = error instanceof Error ? error.message : "Попробуйте ещё раз";
    }
  } finally {
    isLoading = false;
    isLoadingMore = false;
    render();
    if (!append) requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

app.addEventListener("submit", (event) => {
  if (event.target.id === "ingredient-form") {
    event.preventDefault();
    const input = event.target.querySelector("input");
    if (ingredientSuggestions.length && activeSuggestionIndex >= 0) {
      chooseIngredientSuggestion(ingredientSuggestions[activeSuggestionIndex]);
    } else {
      addIngredients([input.value]);
    }
  }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "ingredient-input") updateIngredientSuggestions(event.target.value);
  if (event.target.matches("[data-catalog-search]")) {
    catalogQuery = event.target.value;
    updateCatalogResults();
  }
});

app.addEventListener("focusin", (event) => {
  if (event.target.id === "ingredient-input") updateIngredientSuggestions(event.target.value);
});

app.addEventListener("focusout", (event) => {
  if (event.target.id !== "ingredient-input") return;
  setTimeout(() => {
    const input = document.querySelector("#ingredient-input");
    const list = document.querySelector("#ingredient-suggestions");
    if (!input || !list || document.activeElement === input) return;
    ingredientSuggestions = [];
    activeSuggestionIndex = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    list.hidden = true;
    list.replaceChildren();
  }, 100);
});

app.addEventListener("keydown", (event) => {
  if (event.target.id !== "ingredient-input" || !ingredientSuggestions.length) return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    activeSuggestionIndex = (activeSuggestionIndex + direction + ingredientSuggestions.length) % ingredientSuggestions.length;
    paintSuggestionSelection();
  }
  if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    chooseIngredientSuggestion(ingredientSuggestions[activeSuggestionIndex]);
  }
  if (event.key === "Escape") {
    ingredientSuggestions = [];
    activeSuggestionIndex = -1;
    event.target.setAttribute("aria-expanded", "false");
    event.target.removeAttribute("aria-activedescendant");
    const list = document.querySelector("#ingredient-suggestions");
    if (list) {
      list.hidden = true;
      list.replaceChildren();
    }
  }
});

app.addEventListener("pointerdown", (event) => {
  const suggestion = event.target.closest("[data-suggest-ingredient]");
  if (suggestion) {
    event.preventDefault();
    chooseIngredientSuggestion(suggestion.dataset.suggestIngredient);
    return;
  }
  const card = event.target.closest(".swipe-card.front");
  if (!card || event.target.closest("button") || swipeBusy) return;
  card.classList.remove("swipe-hint");
  swipeGesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, card, dragging: false };
  card.setPointerCapture?.(event.pointerId);
});

app.addEventListener("pointermove", (event) => {
  if (!swipeGesture || swipeGesture.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipeGesture.startX;
  const dy = event.clientY - swipeGesture.startY;
  if (!swipeGesture.dragging && Math.abs(dx) < 8) return;
  if (!swipeGesture.dragging && Math.abs(dy) > Math.abs(dx)) {
    swipeGesture = null;
    return;
  }
  swipeGesture.dragging = true;
  event.preventDefault();
  const rotation = Math.max(-9, Math.min(9, dx / 18));
  swipeGesture.card.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;
  swipeGesture.card.style.setProperty("--swipe-progress", String(Math.min(1, Math.abs(dx) / 110)));
  swipeGesture.card.dataset.swipeDirection = dx >= 0 ? "right" : "left";
});

function endSwipeGesture(event) {
  if (!swipeGesture || swipeGesture.pointerId !== event.pointerId) return;
  const { card, startX, dragging } = swipeGesture;
  const dx = event.clientX - startX;
  swipeGesture = null;
  card.releasePointerCapture?.(event.pointerId);
  if (dragging && Math.abs(dx) >= 75) {
    card.style.removeProperty("transform");
    finishSwipe(dx > 0 ? "right" : "left");
    return;
  }
  card.style.removeProperty("transform");
  card.style.removeProperty("--swipe-progress");
  delete card.dataset.swipeDirection;
}

app.addEventListener("pointerup", endSwipeGesture);
app.addEventListener("pointercancel", endSwipeGesture);

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.google?.accounts?.id?.disableAutoSelect();
    authUser = null;
    authModalOpen = false;
    render();
  }
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.view) setView(target.dataset.view);
  if (target.dataset.suggestIngredient) chooseIngredientSuggestion(target.dataset.suggestIngredient);
  if (target.dataset.addIngredient) addIngredients([target.dataset.addIngredient]);
  if (target.dataset.removeIngredient) {
    state.ingredients = state.ingredients.filter((item) => item !== target.dataset.removeIngredient);
    state.priorityIngredients = state.priorityIngredients.filter((item) => item !== target.dataset.removeIngredient);
    recentRecipeTitles = [];
    recentSourceIds = [];
    saveState();
    recipes = [];
    generationError = "";
    render();
  }
  if (target.dataset.priorityIngredient) {
    const ingredient = target.dataset.priorityIngredient;
    state.priorityIngredients = state.priorityIngredients.includes(ingredient)
      ? state.priorityIngredients.filter((item) => item !== ingredient)
      : [...state.priorityIngredients, ingredient].slice(-3);
    saveState();
    target.classList.toggle("active", state.priorityIngredients.includes(ingredient));
    target.setAttribute("aria-pressed", String(state.priorityIngredients.includes(ingredient)));
  }
  if (target.dataset.equipment) {
    const id = target.dataset.equipment;
    state.equipment = state.equipment.includes(id) ? state.equipment.filter((item) => item !== id) : [...state.equipment, id];
    saveState();
    const active = state.equipment.includes(id);
    target.classList.toggle("active", active);
    target.setAttribute("aria-pressed", String(active));
    const mark = target.querySelector(".equipment-mark");
    if (mark) mark.textContent = active ? "●" : "○";
  }
  if (target.dataset.difficulty) {
    state.difficulty = target.dataset.difficulty;
    saveState();
    target.parentElement?.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === target));
  }
  if (target.dataset.searchMode) {
    state.searchMode = target.dataset.searchMode;
    recipes = [];
    hasMoreRecipes = false;
    saveState();
    target.parentElement?.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === target));
    if (catalogRecipes.length) resetSwipeDeck();
  }
  if (target.dataset.maxMinutes !== undefined) {
    state.maxMinutes = Number(target.dataset.maxMinutes) || 0;
    recipes = [];
    hasMoreRecipes = false;
    saveState();
    target.parentElement?.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === target));
    if (catalogRecipes.length) resetSwipeDeck();
  }
  if (target.dataset.kitchenCourse) {
    state.course = target.dataset.kitchenCourse;
    recipes = [];
    hasMoreRecipes = false;
    saveState();
    target.parentElement?.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === target));
    if (catalogRecipes.length) resetSwipeDeck();
  }
  if (target.dataset.portions) {
    state.portions = Math.min(8, Math.max(1, state.portions + Number(target.dataset.portions)));
    catalogRecipes = [];
    swipeIndex = 0;
    saveState();
    const output = target.parentElement?.querySelector("output");
    if (output) output.textContent = String(state.portions);
  }
  if (target.dataset.catalogDifficulty) {
    catalogDifficulty = target.dataset.catalogDifficulty;
    activateCatalogFilter(target);
  }
  if (target.dataset.catalogCuisine) {
    catalogCuisine = target.dataset.catalogCuisine;
    activateCatalogFilter(target);
  }
  if (target.dataset.catalogCourse) {
    catalogCourse = target.dataset.catalogCourse;
    activateCatalogFilter(target);
  }
  if (target.dataset.catalogProtein) {
    catalogProtein = target.dataset.catalogProtein;
    activateCatalogFilter(target);
  }
  if (target.dataset.catalogAvailability) {
    catalogAvailability = target.dataset.catalogAvailability;
    activateCatalogFilter(target);
  }
  if (target.dataset.catalogMaxMinutes !== undefined) {
    catalogMaxMinutes = Number(target.dataset.catalogMaxMinutes) || 0;
    activateCatalogFilter(target);
  }
  if (target.dataset.swipe) finishSwipe(target.dataset.swipe);
  if (target.dataset.action === "restart-swipe") {
    swipeHistory = swipeHistory.filter((item) => item?.action !== "skip");
    saveSwipeHistory();
    resetSwipeDeck();
    swipeHintPending = true;
    render();
  }
  if (target.dataset.action === "load-catalog") loadCatalog(true);
  if (target.dataset.action === "generate") generateRecipes();
  if (target.dataset.action === "load-more") generateRecipes({ append: true });
  if (target.dataset.action === "toggle-ingredients") {
    ingredientsExpanded = !ingredientsExpanded;
    const collapsed = !ingredientsExpanded;
    const list = document.querySelector(".selected-ingredients");
    const quick = document.querySelector(".quick-row");
    const priority = document.querySelector(".priority-products");
    list?.classList.toggle("is-collapsed", collapsed);
    quick?.classList.toggle("is-collapsed", collapsed);
    priority?.classList.toggle("is-collapsed", collapsed);
    quick?.setAttribute("aria-hidden", String(collapsed));
    target.setAttribute("aria-expanded", String(ingredientsExpanded));
    target.textContent = ingredientsExpanded ? "Свернуть" : `Показать все · ${state.ingredients.length}`;
  }
  if (target.dataset.action === "request-clear-products") {
    clearProductsConfirmationOpen = true;
    document.body.classList.add("no-scroll");
    render();
  }
  if (target.dataset.action === "cancel-clear-products") {
    clearProductsConfirmationOpen = false;
    document.body.classList.remove("no-scroll");
    render();
  }
  if (target.dataset.action === "confirm-clear-products") {
    state.ingredients = [];
    state.priorityIngredients = [];
    ingredientsExpanded = false;
    clearProductsConfirmationOpen = false;
    recipes = [];
    recentRecipeTitles = [];
    recentSourceIds = [];
    generationError = "";
    saveState();
    document.body.classList.remove("no-scroll");
    render();
  }
  if (target.dataset.action === "account") {
    authModalOpen = true;
    authError = "";
    render();
  }
  if (target.dataset.action === "close-auth") {
    authModalOpen = false;
    authError = "";
    render();
  }
  if (target.dataset.action === "logout") logout();
  if (target.dataset.toggleFavoriteSource) {
    const source = selectRecipeSource(target.dataset.toggleFavoriteSource);
    toggleFavorite(source[Number(target.dataset.recipeIndex)], target);
  }
  if (target.dataset.toggleActiveFavorite !== undefined) toggleFavorite(activeRecipe, target);
  if (target.dataset.action === "start-cooking") setCookingMode(true);
  if (target.dataset.action === "stop-cooking") setCookingMode(false);
  if (target.dataset.action === "previous-cooking-step") {
    cookingStep = Math.max(0, cookingStep - 1);
    stopCookingTimer();
    render();
  }
  if (target.dataset.action === "next-cooking-step") {
    cookingStep = Math.min((activeRecipe?.steps?.length || 1) - 1, cookingStep + 1);
    stopCookingTimer();
    render();
  }
  if (target.dataset.action === "start-step-timer") startCookingTimer(Number(target.dataset.timerMinutes));
  if (target.dataset.action === "finish-cooking" && activeRecipe) finishCooking(activeRecipe);
  if (target.dataset.rateRecipe && activeRecipe) rateCookedRecipe(activeRecipe, target.dataset.rateRecipe);
  if (target.dataset.openRecipe !== undefined) {
    const source = selectRecipeSource(target.dataset.recipeSource);
    activeRecipe = source[Number(target.dataset.openRecipe)];
    if (!activeRecipe) return;
    cookingMode = false;
    cookingStep = 0;
    stopCookingTimer();
    render();
    document.body.classList.add("no-scroll");
    document.querySelector(".recipe-sheet [data-action='close-recipe']")?.focus();
  }
  if (target.dataset.action === "close-recipe") {
    setCookingMode(false);
    activeRecipe = null;
    document.body.classList.remove("no-scroll");
    render();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && clearProductsConfirmationOpen) {
    clearProductsConfirmationOpen = false;
    document.body.classList.remove("no-scroll");
    render();
    return;
  }
  if (event.key === "Escape" && activeRecipe) {
    setCookingMode(false);
    activeRecipe = null;
    document.body.classList.remove("no-scroll");
    render();
  }
  if (event.key === "Escape" && authModalOpen) {
    authModalOpen = false;
    authError = "";
    render();
  }
});

window.addEventListener("resize", () => requestAnimationFrame(clampSelectedIngredients));

render({ preserveScroll: false });
restoreSession();
if ((currentView === "catalog" || currentView === "swipe") && !catalogRecipes.length) loadCatalog();
