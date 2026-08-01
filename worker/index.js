const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const recipeSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          minutes: { type: "integer" },
          difficulty: { type: "string" },
          match: { type: "integer" },
          missing: { type: "array", items: { type: "string" } },
          uses: { type: "array", items: { type: "string" } },
          equipment: { type: "array", items: { type: "string" } },
          why: { type: "string" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                amount: { type: "string" },
              },
              required: ["name", "amount"],
            },
          },
          steps: { type: "array", minItems: 3, items: { type: "string" } },
          tip: { type: "string" },
        },
        required: ["title", "subtitle", "minutes", "difficulty", "match", "missing", "uses", "equipment", "why", "ingredients", "steps", "tip"],
      },
    },
  },
  required: ["recipes"],
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function sanitizeList(value, max = 40) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, max);
}

function parseAiResult(result) {
  const value = result?.response ?? result;
  if (typeof value === "object" && value?.recipes) return value;
  if (typeof value !== "string") throw new Error("Unexpected AI response");
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

async function generateRecipes(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Некорректный запрос" }, 400);
  }

  const ingredients = sanitizeList(body.ingredients);
  const equipment = sanitizeList(body.equipment, 12);
  const minutes = Math.min(120, Math.max(10, Number(body.minutes) || 30));
  const portions = Math.min(8, Math.max(1, Number(body.portions) || 2));
  const strict = body.strict !== false;

  if (!ingredients.length) return json({ error: "Добавьте хотя бы один продукт" }, 400);

  const system = `Ты — внимательный редактор современной русской кулинарной книги. Составь ровно 3 реалистичных домашних рецепта. Пиши только по-русски, без англицизмов и выдуманных техник. Соль, вода, растительное масло и чёрный перец считаются базовыми. Не предлагай опасные способы приготовления. Каждый шаг должен быть коротким, конкретным и выполнимым.`;
  const user = `Продукты дома: ${ingredients.join(", ")}.
Инвентарь: ${equipment.length ? equipment.join(", ") : "обычная базовая кухня"}.
Время: до ${minutes} минут. Порций: ${portions}.
Режим: ${strict ? "не предлагай рецепт, если нужно докупать больше одного небазового продукта" : "можно указать до двух недостающих продуктов"}.
Расположи блюда от самого подходящего. Количество ингредиентов укажи на ${portions} порции. match — честный процент совпадения от 0 до 100. В uses перечисли использованные продукты пользователя, в missing — только реально недостающие небазовые продукты.`;

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      guided_json: recipeSchema,
      max_tokens: 2200,
      temperature: 0.45,
    });
    const data = parseAiResult(result);
    if (!Array.isArray(data.recipes) || data.recipes.length < 3) throw new Error("Incomplete recipes");
    return json({ recipes: data.recipes.slice(0, 3) });
  } catch (error) {
    console.error("recipe_generation_failed", error instanceof Error ? error.message : String(error));
    return json({ error: "Не удалось составить меню" }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/generate" && request.method === "POST") {
      return generateRecipes(request, env);
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "kutno" });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Маршрут не найден" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
