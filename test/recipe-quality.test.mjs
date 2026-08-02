import assert from "node:assert/strict";
import test from "node:test";

import worker, { recipeQualityIssues, recipeTitlesAreDuplicate } from "../worker/index.js";

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
    "Разогрейте сухую сковороду на среднем огне 2 минуты.",
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
  const env = {
    AI: {
      async run() {
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
  assert.equal(body.recipes[0].title, "Жареный сыр");
});
