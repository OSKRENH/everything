import featureWorker from "./entry.js";
import {
  analyzeRecipe,
  enrichRecipeSemantics,
  MANUAL_EQUIPMENT,
} from "../src/ingredient-semantics-v3.js";
import {
  applyMatchingUserContext,
  matchingPayloadFromContext,
} from "../src/matching-user-context.js";
import { manualRecipesForPortions } from "./manual-recipes.js";

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
  const user = matchingPayloadFromContext(body);
  return {
    ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
    priorityIngredients: Array.isArray(body.priorityIngredients) ? body.priorityIngredients : [],
    equipment: Array.isArray(body.equipment) ? body.equipment : [],
    baseIngredients: Array.isArray(body.baseIngredients) ? body.baseIngredients : undefined,
    pantry: user.pantry,
    feedback: user.feedback,
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

function analyzeWithContext(recipe, context) {
  return applyMatchingUserContext(recipe, analyzeRecipe(recipe, context), context);
}

function enrichedWithContext(recipe, context, analysis = analyzeWithContext(recipe, context)) {
  const enriched = enrichRecipeSemantics(recipe, context);
  return {
    ...enriched,
    matching: {
      ...(enriched.matching || {}),
      group: analysis.group,
      score: analysis.score,
      reasons: analysis.reasons,
      missingRequired: analysis.requiredMissing.map((item) => item.name),
      missingOptional: analysis.optionalMissing.map((item) => item.name),
      substitutions: analysis.substitutions.map((item) => ({ ingredient: item.name, owned: item.match?.owned || "" })),
      missingEquipment: analysis.missingEquipment,
      priorityHits: analysis.priorityHits,
      quantityShortages: analysis.quantityShortages.map((item) => ({
        name: item.name,
        have: `${item.have.quantity} ${item.have.unit}`.trim(),
        need: item.need,
      })),
      preferencePenalty: analysis.preferencePenalty,
    },
  };
}

function rankRecipes(recipes, body) {
  const context = matchingContext(body);
  const targetDifficulty = difficultyRank(body.difficulty);
  return recipes
    .map((recipe) => {
      const analysis = analyzeWithContext(recipe, context);
      const enriched = enrichedWithContext(recipe, context, analysis);
      const sourceType = enriched.source?.type;
      const verifiedBonus = sourceType === "kutno-manual-catalog"
        ? 48
        : sourceType === "kutno-catalog"
          ? 40
          : sourceType === "generated"
            ? -30
            : 0;
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
  const portions = Math.min(8, Math.max(1, Number(body.portions) || 2));
  const url = new URL(request.url);
  url.pathname = "/api/catalog";
  url.search = `?portions=${portions}`;
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("content-type");
  const response = await featureWorker.fetch(new Request(url, { method: "GET", headers }), env, ctx);
  const data = response.ok ? await response.json().catch(() => ({})) : {};
  const baseRecipes = Array.isArray(data.recipes) ? data.recipes : [];
  return mergeRecipes(baseRecipes, manualRecipesForPortions(portions));
}

async function runBaseGenerate(body, request, env, ctx) {
  const generationBody = {
    ...body,
    equipment: [...new Set([...(Array.isArray(body.equipment) ? body.equipment : []), ...MANUAL_EQUIPMENT])],
  };
  const response = await featureWorker.fetch(requestWithJson(request, generationBody), env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data) return { response, data: null, recipes: [] };
  const recipes = Array.isArray(data.recipes) ? rankRecipes(data.recipes, body).map((item) => item.recipe) : [];
  return { response, data, recipes };
}

function resultResponse(recipes, body, { source = "semantic-catalog", hasMore = false, suggestedExpansion = null, extra = {} } = {}) {
  return json({
    ...extra,
    recipes: recipes.slice(0, 3),
    hasMore,
    source,
    relaxation: null,
    ...(suggestedExpansion ? { suggestedExpansion } : {}),
    originalFilters: {
      searchMode: body.searchMode,
      maxMinutes: body.maxMinutes,
      course: body.course,
    },
  });
}

function expansionSuggestion(body, catalog) {
  if (body.searchMode !== "plus-one") {
    const plusOne = rankRecipes(catalog, { ...body, searchMode: "plus-one" });
    if (plusOne.length) {
      return {
        code: "allow-one-purchase",
        title: "Точных вариантов пока нет",
        details: "Можно отдельно разрешить блюда, где не хватает ровно одного обязательного продукта.",
        count: plusOne.length,
      };
    }
  }
  if (Number(body.maxMinutes) || (body.course && body.course !== "все")) {
    const withoutFilters = rankRecipes(catalog, { ...body, maxMinutes: 0, course: "все" });
    if (withoutFilters.length) {
      return {
        code: "relax-filters",
        title: "Мешают дополнительные фильтры",
        details: "Продукты и техника останутся прежними; изменятся только время и тип блюда.",
        count: withoutFilters.length,
      };
    }
  }
  return null;
}

async function smartGenerate(request, env, ctx) {
  const body = await request.clone().json().catch(() => ({}));
  if (!Array.isArray(body.ingredients) || !body.ingredients.length) return featureWorker.fetch(request, env, ctx);

  const catalog = await loadCatalogForMatching(request, env, ctx, body);
  const catalogRanked = rankRecipes(catalog, body).map((item) => item.recipe);
  let generated = { response: new Response(null, { status: 200 }), data: null, recipes: [] };

  if (catalogRanked.length < 3) generated = await runBaseGenerate(body, request, env, ctx);
  const combined = mergeRecipes(catalogRanked, generated.recipes);
  if (combined.length) {
    const manualOnly = combined.every((recipe) => recipe.source?.type === "kutno-manual-catalog");
    return resultResponse(combined, body, {
      source: manualOnly ? "manual-catalog" : catalogRanked.length ? "semantic-catalog" : "workers-ai",
      hasMore: catalogRanked.length > 3 || Boolean(generated.data?.hasMore),
      extra: generated.data || {},
    });
  }

  const suggestedExpansion = expansionSuggestion(body, catalog);
  if (suggestedExpansion) {
    return resultResponse([], body, {
      source: "semantic-catalog",
      suggestedExpansion,
      extra: { error: suggestedExpansion.title },
    });
  }

  if (!generated.data && !generated.response.ok) return generated.response;
  return json(generated.data || {
    recipes: [],
    hasMore: false,
    error: "Для этого набора пока нет рецепта без дополнительных покупок",
    relaxation: null,
  }, generated.response.status || 200);
}

async function enrichedCatalog(request, env, ctx) {
  const response = await featureWorker.fetch(request, env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data || !response.ok) return response;
  const url = new URL(request.url);
  const portions = Math.min(8, Math.max(1, Number(url.searchParams.get("portions")) || 2));
  const context = {
    ingredients: url.searchParams.getAll("ingredient"),
    priorityIngredients: url.searchParams.getAll("priority"),
    equipment: url.searchParams.getAll("equipment"),
  };
  const recipes = mergeRecipes(data.recipes || [], manualRecipesForPortions(portions));
  return json({
    ...data,
    recipes: rankRecipes(recipes, context).map((item) => item.recipe),
    total: recipes.length,
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
