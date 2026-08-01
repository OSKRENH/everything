import "./styles.css";

const STORAGE_KEY = "kutno-kitchen-v2";

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
  equipment: ["pan", "pot"],
  minutes: "30",
  difficulty: "просто",
  portions: 2,
  strict: true,
};

const fallbackRecipes = [
  {
    title: "Жареный рис с яйцом",
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
      { name: "соевый соус или соль", amount: "по вкусу" },
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
      { name: "масло, соль, перец", amount: "по вкусу" },
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
      { name: "соль и перец", amount: "по вкусу" },
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
      { name: "соль и специи", amount: "по вкусу" },
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
];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

let state = loadState();
let recipes = [];
let isLoading = false;
let activeRecipe = null;

const app = document.querySelector("#app");

function normalize(value) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function render() {
  app.innerHTML = `
    <div class="page-shell">
      <header class="site-header">
        <a class="wordmark" href="#top" aria-label="Кутно, на главную">Кутно</a>
        <div class="header-note">Кухонная картотека<br>Выпуск 01 — ${new Date().getFullYear()}</div>
        <button class="text-button header-clear" data-action="clear-all" ${state.ingredients.length ? "" : "disabled"}>Очистить кухню</button>
      </header>

      <main id="top">
        <section class="intro-grid" aria-labelledby="main-title">
          <div class="intro-copy">
            <p class="eyebrow">Рецепты из того, что уже дома</p>
            <h1 id="main-title">Сначала&nbsp;—<br>что есть<br>на кухне?</h1>
            <p class="intro-footnote"><span>①</span> Соль, воду и масло можно не указывать — мы считаем их базовыми.</p>
          </div>

          <div class="kitchen-form">
            <section class="form-section ingredient-section">
              <div class="section-index">01</div>
              <div class="section-content">
                <label for="ingredient-input">Продукты</label>
                <form id="ingredient-form" class="ingredient-form">
                  <input id="ingredient-input" autocomplete="off" placeholder="Например: курица, рис, лук" aria-describedby="ingredient-hint">
                  <button type="submit" aria-label="Добавить продукты">Добавить</button>
                </form>
                <p id="ingredient-hint" class="microcopy">Можно перечислить несколько продуктов через запятую.</p>
                <div class="selected-ingredients" aria-live="polite">
                  ${state.ingredients.length
                    ? state.ingredients.map((item) => `<button class="ingredient-tag selected" data-remove-ingredient="${escapeHtml(item)}">${escapeHtml(item)} <span aria-hidden="true">×</span></button>`).join("")
                    : `<span class="empty-line">Пока пусто — начните с главного продукта</span>`}
                </div>
                <div class="quick-row" aria-label="Частые продукты">
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

            <section class="form-section preferences-section">
              <div class="section-index">03</div>
              <div class="section-content preference-columns">
                <fieldset>
                  <legend>Время</legend>
                  <div class="segmented">
                    ${["15", "30", "60"].map((value) => `<button type="button" class="${state.minutes === value ? "active" : ""}" data-minutes="${value}">${value} мин</button>`).join("")}
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
                <label class="strict-option">
                  <input type="checkbox" id="strict-toggle" ${state.strict ? "checked" : ""}>
                  <span class="checkmark" aria-hidden="true"></span>
                  Без похода в магазин
                </label>
              </div>
            </section>

            <button class="primary-action" data-action="generate" ${!state.ingredients.length || isLoading ? "disabled" : ""}>
              <span>${isLoading ? "Составляем меню…" : "Предложить три блюда"}</span>
              <span aria-hidden="true">↘</span>
            </button>
            ${!state.ingredients.length ? `<p class="action-note">Добавьте хотя бы один продукт</p>` : ""}
          </div>
        </section>

        ${renderResults()}
      </main>

      <footer>
        <span>Кутно</span>
        <span>Не заменяет вкус — помогает начать.</span>
      </footer>
    </div>
    ${activeRecipe ? renderRecipeOverlay(activeRecipe) : ""}
  `;
}

function renderResults() {
  if (isLoading) {
    return `
      <section class="results-section loading-results" aria-live="polite">
        <div class="results-heading"><span>Меню</span><h2>Листаем варианты…</h2></div>
        <div class="loading-rule"></div><div class="loading-rule short"></div><div class="loading-rule"></div>
      </section>`;
  }

  if (!recipes.length) {
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
        ${recipes.map((recipe, index) => renderRecipeCard(recipe, index)).join("")}
      </div>
    </section>`;
}

function renderRecipeCard(recipe, index) {
  const missing = Array.isArray(recipe.missing) ? recipe.missing : [];
  const uses = Array.isArray(recipe.uses) ? recipe.uses : [];
  return `
    <article class="recipe-entry">
      <div class="recipe-number">${String(index + 1).padStart(2, "0")}</div>
      <div class="recipe-main">
        <div class="recipe-status ${missing.length ? "has-missing" : "complete"}">
          ${missing.length ? `Не хватает: ${missing.map(escapeHtml).join(", ")}` : "Всё есть"}
        </div>
        <h3>${escapeHtml(recipe.title)}</h3>
        <p class="recipe-subtitle">${escapeHtml(recipe.subtitle || recipe.why)}</p>
        <div class="recipe-meta">
          <span>${Number(recipe.minutes) || state.minutes} мин</span>
          <span>${escapeHtml(recipe.difficulty || "просто")}</span>
          <span>${Number(recipe.match) || Math.max(50, 100 - missing.length * 18)}% совпадение</span>
        </div>
      </div>
      <div class="recipe-side">
        <p>${escapeHtml(recipe.why)}</p>
        ${uses.length ? `<p class="uses-line">Используем: ${uses.slice(0, 5).map(escapeHtml).join(", ")}</p>` : ""}
        <button class="open-recipe" data-open-recipe="${index}">Открыть рецепт <span aria-hidden="true">→</span></button>
      </div>
    </article>`;
}

function renderRecipeOverlay(recipe) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  return `
    <div class="recipe-overlay" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
      <button class="overlay-backdrop" data-action="close-recipe" aria-label="Закрыть рецепт"></button>
      <article class="recipe-sheet">
        <div class="sheet-topline">
          <span>Кутно / рецепт</span>
          <button data-action="close-recipe">Закрыть ×</button>
        </div>
        <header class="sheet-header">
          <p>${escapeHtml(recipe.subtitle || "Рецепт из того, что есть")}</p>
          <h2 id="recipe-title">${escapeHtml(recipe.title)}</h2>
          <div class="sheet-meta"><span>${recipe.minutes} мин</span><span>${state.portions} порции</span><span>${escapeHtml(recipe.difficulty || "просто")}</span></div>
        </header>
        <div class="sheet-grid">
          <section>
            <h3>Что понадобится</h3>
            <ol class="ingredient-ledger">
              ${ingredients.map((item) => `<li><span>${escapeHtml(item.name)}</span><b>${escapeHtml(item.amount)}</b></li>`).join("")}
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
        </div>
      </article>
    </div>`;
}

function addIngredients(values) {
  const next = values
    .flatMap((value) => value.split(/[,;\n]+/))
    .map(normalize)
    .filter(Boolean);
  state.ingredients = [...new Set([...state.ingredients, ...next])];
  saveState();
  render();
}

function getFallbackSuggestions() {
  const have = state.ingredients.map(normalize);
  const scored = fallbackRecipes.map((recipe) => {
    const uses = recipe.required.filter((item) => have.some((owned) => owned.includes(item) || item.includes(owned)));
    const missing = recipe.required.filter((item) => !uses.includes(item));
    const match = Math.round((uses.length / recipe.required.length) * 100);
    return { ...recipe, uses, missing, match };
  });
  const eligible = state.strict ? scored.filter((item) => item.missing.length <= 1) : scored;
  return (eligible.length >= 3 ? eligible : scored)
    .sort((a, b) => b.match - a.match || a.minutes - b.minutes)
    .slice(0, 3);
}

async function generateRecipes() {
  if (!state.ingredients.length || isLoading) return;
  isLoading = true;
  recipes = [];
  render();

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ingredients: state.ingredients,
        equipment: state.equipment.map(equipmentName),
        minutes: Number(state.minutes),
        portions: state.portions,
        strict: state.strict,
      }),
    });
    if (!response.ok) throw new Error("Generation failed");
    const data = await response.json();
    recipes = Array.isArray(data.recipes) && data.recipes.length ? data.recipes.slice(0, 3) : getFallbackSuggestions();
  } catch {
    recipes = getFallbackSuggestions();
  } finally {
    isLoading = false;
    render();
    requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

app.addEventListener("submit", (event) => {
  if (event.target.id !== "ingredient-form") return;
  event.preventDefault();
  const input = event.target.querySelector("input");
  addIngredients([input.value]);
});

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.addIngredient) addIngredients([target.dataset.addIngredient]);
  if (target.dataset.removeIngredient) {
    state.ingredients = state.ingredients.filter((item) => item !== target.dataset.removeIngredient);
    saveState();
    recipes = [];
    render();
  }
  if (target.dataset.equipment) {
    const id = target.dataset.equipment;
    state.equipment = state.equipment.includes(id) ? state.equipment.filter((item) => item !== id) : [...state.equipment, id];
    saveState();
    render();
  }
  if (target.dataset.minutes) {
    state.minutes = target.dataset.minutes;
    saveState();
    render();
  }
  if (target.dataset.portions) {
    state.portions = Math.min(8, Math.max(1, state.portions + Number(target.dataset.portions)));
    saveState();
    render();
  }
  if (target.dataset.action === "generate") generateRecipes();
  if (target.dataset.action === "clear-all") {
    state = { ...defaults, equipment: [...defaults.equipment] };
    recipes = [];
    saveState();
    render();
  }
  if (target.dataset.openRecipe !== undefined) {
    activeRecipe = recipes[Number(target.dataset.openRecipe)];
    render();
    document.body.classList.add("no-scroll");
    document.querySelector(".recipe-sheet [data-action='close-recipe']")?.focus();
  }
  if (target.dataset.action === "close-recipe") {
    activeRecipe = null;
    document.body.classList.remove("no-scroll");
    render();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.id === "strict-toggle") {
    state.strict = event.target.checked;
    saveState();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeRecipe) {
    activeRecipe = null;
    document.body.classList.remove("no-scroll");
    render();
  }
});

render();
