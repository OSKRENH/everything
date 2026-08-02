import assert from "node:assert/strict";
import test from "node:test";

import worker, { findRecoveryRecipes, recipeQualityIssues, recipeTitlesAreDuplicate } from "../worker/index.js";

function recipe(steps) {
  return {
    title: "Жареный сыр",
    subtitle: "Хрустящий сыр на сковороде",
    minutes: 10,
    difficulty: "легко",
    match: 100,
    missing: [],
    uses: ["сыр"],
    equipment: ["сковорода", "тёрка", "лопатка"],
    why: "Все продукты уже есть дома",
    ingredients: [{ name: "сыр", amount: "120 г" }],
    steps,
    nutrition: { calories: 220, protein: 15, fat: 17, carbs: 1 },
    tip: "Подавайте сразу после остывания",
  };
}

function aiResponse(value) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(value),
        },
      },
    ],
  };
}

test("считает варианты одного блюда дублями, даже если добавлено описание кухни", () => {
  assert.equal(recipeTitlesAreDuplicate("Китайский жареный рис с яйцом", "Жареный рис с яйцом"), true);
  assert.equal(recipeTitlesAreDuplicate("Домашняя шакшука", "Шакшука"), true);
  assert.equal(recipeTitlesAreDuplicate("Жареный рис с яйцом", "Шакшука"), false);
});

test("повторяет генерацию, если продукт не помещён в посуду перед нагревом", async () => {
  const drafts = [
    recipe([
      "Натереть сыр на крупной тёрке.",
      "Разогреть сковороду на среднем огне.",
      "Готовить сыр до расплавления.",
    ]),
    recipe([
      "Натереть сыр на крупной тёрке.",
      "Разогреть сухую сковороду на среднем огне.",
      "Выложить сыр тонким слоем на сковороду и готовить 2 минуты, пока он не расплавится и не подрумянится снизу.",
      "Снять сыр лопаткой и дать ему остыть 1 минуту перед подачей.",
    ]),
  ];
  let calls = 0;
  const env = {
    AI: {
      async run(model, options) {
        assert.equal(model, "@cf/openai/gpt-oss-120b");
        assert.equal(options.response_format.type, "json_schema");
        const draft = drafts[Math.min(calls, drafts.length - 1)];
        calls += 1;
        return aiResponse({ recipes: [draft] });
      },
    },
    ASSETS: {
      fetch() {
        return new Response("not found", { status: 404 });
      },
    },
  };

  const response = await worker.fetch(new Request("https://kutno.ru/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ingredients: ["сыр"],
      equipment: ["сковорода", "тёрка", "лопатка"],
      difficulty: "легко",
      portions: 2,
    }),
  }), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.equal(body.source, "workers-ai");
  assert.match(body.recipes[0].steps.join(" "), /выложить сыр.+сковороду/iu);
});

test("повторяет генерацию, если количество в шагах расходится со списком ингредиентов", async () => {
  const drafts = [
    recipe([
      "Натереть 200 г сыра на крупной тёрке.",
      "Разогреть сухую сковороду на среднем огне.",
      "Выложить сыр тонким слоем на сковороду и готовить 2 минуты, пока он не расплавится.",
      "Снять готовый сыр лопаткой и подавать горячим.",
    ]),
    recipe([
      "Натереть сыр на крупной тёрке.",
      "Разогреть сухую сковороду на среднем огне.",
      "Выложить сыр тонким слоем на сковороду и готовить 2 минуты, пока он не расплавится.",
      "Снять готовый сыр лопаткой и подавать горячим.",
    ]),
  ];
  let calls = 0;
  const env = {
    AI: {
      async run() {
        const draft = drafts[Math.min(calls, drafts.length - 1)];
        calls += 1;
        return aiResponse({ recipes: [draft] });
      },
    },
    ASSETS: { fetch: () => new Response("not found", { status: 404 }) },
  };

  const response = await worker.fetch(new Request("https://kutno.ru/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ingredients: ["сыр"], equipment: ["сковорода", "тёрка", "лопатка"], portions: 2 }),
  }), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.doesNotMatch(body.recipes[0].steps.join(" "), /200\s*г/iu);
});

test("принимает обычные повелительные действия в связном рецепте", () => {
  const issues = recipeQualityIssues(recipe([
    "Промойте сыр холодной водой и обсушите его полотенцем.",
    "Разогрейте сухую сковороду на среднем огне.",
    "Выложите сыр на сковороду и переверните через 2 минуты, когда снизу появится корочка.",
    "Снимите готовый сыр со сковороды, приправьте и подавайте горячим.",
  ]), ["сыр"]);

  assert.deepEqual(issues, []);
});

test("использует третью попытку, если первые два ответа не прошли проверку", async () => {
  const invalid = recipe([
    "Подготовьте чистую посуду для приготовления.",
    "Разогрейте сковороду на среднем огне 2 минуты.",
    "Снимите сковороду с огня и подавайте блюдо.",
  ]);
  const valid = recipe([
    "Натрите сыр на крупной тёрке.",
    "Разогрейте сухую сковороду на среднем огне 2 минуты.",
    "Выложите сыр тонким слоем на сковороду и готовьте 2 минуты, пока он не расплавится и не подрумянится снизу.",
    "Снимите готовый сыр лопаткой и подавайте горячим.",
  ]);
  let calls = 0;
  const temperatures = [];
  const env = {
    AI: {
      async run(_model, options) {
        temperatures.push(options.temperature);
        const draft = calls < 2 ? invalid : valid;
        calls += 1;
        return aiResponse({ recipes: [draft] });
      },
    },
    ASSETS: { fetch: () => new Response("not found", { status: 404 }) },
  };

  const response = await worker.fetch(new Request("https://kutno.ru/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ingredients: ["сыр"], equipment: ["сковорода"], portions: 2 }),
  }), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(temperatures, [0.35, 0.2, 0.65]);
  assert.equal(body.recipes[0].title, "Жареный сыр");
});

test("переключается на лёгкую модель, если основная недоступна", async () => {
  const models = [];
  const env = {
    AI: {
      async run(model) {
        models.push(model);
        if (model === "@cf/openai/gpt-oss-120b") throw new Error("model capacity exceeded");
        return aiResponse({ recipes: [recipe([
          "Натрите сыр на крупной тёрке.",
          "Разогрейте сухую сковороду на среднем огне.",
          "Выложите сыр на сковороду и готовьте 2 минуты, пока он не расплавится.",
          "Снимите готовый сыр лопаткой и подавайте горячим.",
        ])] });
      },
    },
    ASSETS: { fetch: () => new Response("not found", { status: 404 }) },
  };

  const response = await worker.fetch(new Request("https://kutno.ru/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ingredients: ["сыр"], equipment: ["сковорода"], portions: 2 }),
  }), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(models, ["@cf/openai/gpt-oss-120b", "@cf/openai/gpt-oss-20b"]);
  assert.equal(body.recipes[0].title, "Жареный сыр");
});

test("возвращает проверенные новые варианты при недоступности обеих моделей", async () => {
  const ingredients = ["яйца", "рис", "лук", "соевый соус", "макароны", "помидоры", "сыр", "гречка", "брокколи", "мука", "лапша", "курица"];
  const excludeTitles = ["Китайский жареный рис с яйцом", "Жареный рис с яйцом", "Шакшука", "Курица с рисом"];
  const recipes = findRecoveryRecipes({
    ingredients,
    equipment: ["Сковорода", "Кастрюля"],
    difficulty: "легко",
    portions: 2,
    excludeTitles,
  });

  assert.equal(recipes.length, 3);
  assert.equal(recipes.some((item) => excludeTitles.some((title) => recipeTitlesAreDuplicate(title, item.title))), false);
  for (const item of recipes) assert.deepEqual(recipeQualityIssues(item, ingredients), []);
  const chickenSteps = recipes.find((item) => item.title === "Курица с брокколи в соевом соусе").steps.join(" ");
  assert.match(chickenSteps, /нарежьте курицу/iu);
  assert.doesNotMatch(chickenSteps, /нарежьте курица|продуктом «/iu);
  const omeletSteps = recipes.find((item) => item.title === "Омлет с брокколи и сыром").steps.join(" ");
  assert.match(omeletSteps, /посыпьте омлет сыром/iu);
  const noodleRecipe = recipes.find((item) => item.title === "Лапша с курицей и брокколи");
  assert.ok(noodleRecipe);
  assert.match(noodleRecipe.steps.join(" "), /опустите лапшу/iu);

  const env = {
    AI: { run: async () => { throw new Error("daily limit exceeded"); } },
    ASSETS: { fetch: () => new Response("not found", { status: 404 }) },
  };
  const response = await worker.fetch(new Request("https://kutno.ru/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ingredients,
      equipment: ["Сковорода", "Кастрюля"],
      difficulty: "легко",
      portions: 2,
      excludeTitles,
    }),
  }), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.recipes.length, 3);
});
