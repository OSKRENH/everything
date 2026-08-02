import featureWorker from "./entry.js";
import { enrichRecipeSemantics } from "../src/ingredient-semantics.js";

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function requestWithJson(request, body) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(body),
  });
}

function matchingContext(body = {}) {
  return {
    ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
    priorityIngredients: Array.isArray(body.priorityIngredients) ? body.priorityIngredients : [],
    equipment: Array.isArray(body.equipment) ? body.equipment : [],
    baseIngredients: Array.isArray(body.baseIngredients) ? body.baseIngredients : undefined,
  };
}

function enrichPayload(data, body = {}) {
  if (!data || typeof data !== "object" || !Array.isArray(data.recipes)) return data;
  const context = matchingContext(body);
  return {
    ...data,
    recipes: data.recipes.map((recipe) => enrichRecipeSemantics(recipe, context)),
  };
}

async function runGenerate(body, request, env, ctx) {
  const response = await featureWorker.fetch(requestWithJson(request, body), env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data) return { response, data: null };
  return { response, data: enrichPayload(data, body) };
}

async function smartGenerate(request, env, ctx) {
  const body = await request.clone().json().catch(() => ({}));
  const first = await runGenerate(body, request, env, ctx);
  if (!first.data || !first.response.ok || first.data.recipes?.length) {
    return first.data ? json(first.data, first.response.status) : first.response;
  }

  const attempts = [];
  if (body.searchMode !== "plus-one") {
    attempts.push({
      body: { ...body, searchMode: "plus-one" },
      relaxation: {
        code: "allow-one-purchase",
        title: "Показали рецепты с одной покупкой",
        details: "Строго без покупок подходящих вариантов не нашлось.",
      },
    });
  }
  if (Number(body.maxMinutes) || body.course !== "все") {
    attempts.push({
      body: { ...body, searchMode: "plus-one", maxMinutes: 0, course: "все" },
      relaxation: {
        code: "relax-filters",
        title: "Немного расширили поиск",
        details: "Убрали ограничение по времени или типу блюда и разрешили одну покупку.",
      },
    });
  }

  for (const attempt of attempts) {
    const result = await runGenerate(attempt.body, request, env, ctx);
    if (result.data?.recipes?.length) {
      return json({
        ...result.data,
        relaxation: attempt.relaxation,
        originalFilters: {
          searchMode: body.searchMode,
          maxMinutes: body.maxMinutes,
          course: body.course,
        },
      }, 200);
    }
  }

  return json(first.data, first.response.status);
}

async function enrichedCatalog(request, env, ctx) {
  const response = await featureWorker.fetch(request, env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data || !response.ok) return response;
  const url = new URL(request.url);
  const context = {
    ingredients: url.searchParams.getAll("ingredient"),
    priorityIngredients: url.searchParams.getAll("priority"),
    equipment: url.searchParams.getAll("equipment"),
  };
  return json({
    ...data,
    recipes: Array.isArray(data.recipes) ? data.recipes.map((recipe) => enrichRecipeSemantics(recipe, context)) : [],
  }, response.status);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/generate" && request.method === "POST") {
      return smartGenerate(request, env, ctx);
    }
    if (url.pathname === "/api/catalog" && request.method === "GET") {
      return enrichedCatalog(request, env, ctx);
    }
    return featureWorker.fetch(request, env, ctx);
  },
};
