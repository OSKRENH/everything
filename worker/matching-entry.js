import featureWorker from "./entry.js";
import { analyzeRecipe, enrichRecipeSemantics } from "../src/ingredient-semantics-v2.js";

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
  headers.delete("content-length");
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

function normalizedTitle(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

function difficultyRank(value = "") {
  const text = String(value).toLowerCase();
  if (/слож|труд/.test(text)) return 2;
  if (/обыч|сред/.test(text)) return 1;
  return 0;
}

function recipeKey(recipe) {
  return String(recipe?.id || recipe?.source?.id || normalizedTitle(recipe?.title));
}

function mergeRecipes(...groups) {
  const result = [];
  const seen = new Set();
  for (const recipe of groups.flat()) {
    if (!recipe?.title) continue;
    const key = recipeKey(recipe);
    const title = normalizedTitle(recipe.title);
    if (seen.has(key) || result.some((item) => normalizedTitle(item.title) === title)) continue;
    seen.add(key);
    result.push(recipe);
  }
  return result;
}

function recipePassesFilters(recipe, body) {
  if (Number(body.maxMinutes) && Number(recipe.minutes) > Number(body.maxMinutes)) return false;
  if (body.course && body.course !== "все" && recipe.course !== body.course && !(body.course === "перекус" && ["закуска", "салат"].includes(recipe.course))) return false;
  const excluded = Array.isArray(body.excludeTitles) ? body.excludeTitles.map(normalizedTitle) : [];
  return !excluded.includes(normalizedTitle(recipe.title));
}

function groupAllowed(group, searchMode) {
  if (searchMode === "plus-one") return ["ready", "substitute", "one"].includes(group);
  return ["ready", "substitute"].includes(group);
}

function rankRecipes(recipes, body) {
  const context = matchingContext(body);
  const targetDifficulty = difficultyRank(body.difficulty);
  return recipes
    .map((recipe) => {
      const enriched = enrichRecipeSemantics(recipe, context);
      const analysis = analyzeRecipe(enriched, context);
      const verifiedBonus = enriched.source?.type === "kutno-catalog" ? 40 : enriched.source?.type === "generated" ? -30 : 0;
      return {
        recipe: enriched,
        analysis,
        rank: analysis.score + verifiedBonus - Math.abs(difficultyRank(enriched.difficulty) - targetDifficulty) * 12,
      };
    })
    .filter(({ recipe, analysis }) => recipePassesFilters(recipe, body) && groupAllowed(analysis.group, body.searchMode))
    .sort((first, second) => second.rank - first.rank || Number(first.recipe.minutes) - Number(second.recipe.minutes));
}

async function loadCatalogForMatching(request, env, ctx, body) {
  const url = new URL(request.url);
  url.pathname = "/api/catalog";
  url.search = `?portions=${Math.min(8, Math.max(1, Number(body.portions) || 2))}`;
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("content-type");
  const response = await featureWorker.fetch(new Request(url, { method: "GET", headers }), env, ctx);
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.recipes) ? data.recipes : [];
}

async function runBaseGenerate(body, request, env, ctx) {
  const response = await featureWorker.fetch(requestWithJson(request, body), env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data) return { response, data: null, recipes: [] };
  const recipes = Array.isArray(data.recipes) ? rankRecipes(data.recipes, body).map((item) => item.recipe) : [];
  return { response, data, recipes };
}

function resultResponse(recipes, body, { source = "semantic-catalog", hasMore = false, relaxation = null, extra = {} } = {}) {
  return json({
    ...extra,
    recipes: recipes.slice(0, 3),
    hasMore,
    source,
    ...(relaxation ? {
      relaxation,
      originalFilters: {
        searchMode: body.searchMode,
        maxMinutes: body.maxMinutes,
        course: body.course,
      },
    } : {}),
  });
}

async function smartGenerate(request, env, ctx) {
  const body = await request.clone().json().catch(() => ({}));
  if (!Array.isArray(body.ingredients) || !body.ingredients.length) return featureWorker.fetch(request, env, ctx);

  const catalog = await loadCatalogForMatching(request, env, ctx, body);
  const strictCatalog = rankRecipes(catalog, body).map((item) => item.recipe);
  let catalogRecipes = [...strictCatalog];
  let relaxation = null;
  let catalogPoolSize = strictCatalog.length;

  if (catalogRecipes.length < 3 && body.searchMode !== "plus-one") {
    const relaxedBody = { ...body, searchMode: "plus-one" };
    const relaxedCatalog = rankRecipes(catalog, relaxedBody).map((item) => item.recipe);
    const before = catalogRecipes.length;
    catalogRecipes = mergeRecipes(catalogRecipes, relaxedCatalog);
    catalogPoolSize = Math.max(catalogPoolSize, relaxedCatalog.length);
    if (catalogRecipes.length > before) {
      relaxation = {
        code: "allow-one-purchase",
        title: "Добавили варианты с одной покупкой",
        details: "Рецепты без обязательных покупок стоят первыми, затем — ближайшие варианты.",
      };
    }
  }

  if (catalogRecipes.length < 3 && (Number(body.maxMinutes) || body.course !== "все")) {
    const relaxedBody = { ...body, searchMode: "plus-one", maxMinutes: 0, course: "все" };
    const expandedCatalog = rankRecipes(catalog, relaxedBody).map((item) => item.recipe);
    const before = catalogRecipes.length;
    catalogRecipes = mergeRecipes(catalogRecipes, expandedCatalog);
    catalogPoolSize = Math.max(catalogPoolSize, expandedCatalog.length);
    if (catalogRecipes.length > before) {
      relaxation = {
        code: "relax-filters",
        title: "Немного расширили поиск",
        details: "Сохранили ваши продукты и технику, но убрали ограничение по времени или типу блюда.",
      };
    }
  }

  if (catalogRecipes.length) {
    return resultResponse(catalogRecipes, body, {
      hasMore: catalogPoolSize > 3,
      relaxation,
    });
  }

  const base = await runBaseGenerate(body, request, env, ctx);
  if (!base.data && !base.response.ok) return base.response;
  if (base.recipes.length) {
    return resultResponse(base.recipes, body, {
      source: base.recipes.every((recipe) => recipe.source?.type === "kutno-catalog") ? "semantic-catalog" : "workers-ai",
      hasMore: Boolean(base.data?.hasMore),
      extra: base.data,
    });
  }

  return json(base.data || { recipes: [], hasMore: false, error: "Добавьте ещё один основной продукт или разрешите одну покупку" }, base.response.status || 200);
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
    if (url.pathname === "/api/generate" && request.method === "POST") return smartGenerate(request, env, ctx);
    if (url.pathname === "/api/catalog" && request.method === "GET") return enrichedCatalog(request, env, ctx);
    return featureWorker.fetch(request, env, ctx);
  },
};
