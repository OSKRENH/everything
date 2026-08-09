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
import { catalogFullRecipes } from "./catalog-page.js";

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
    priorityIngredients: [],
    equipment: Array.isArray(body.equipment) ? body.equipment : [],
    baseIngredients: Array.isArray(body.baseIngredients) ? body.baseIngredients : undefined,
    pantry: user.pantry,
    feedback: user.feedback,
  };
}

function normalizedTitle(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
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

function verifiedSourceBonus(recipe) {
  const sourceType = recipe?.source?.type;
  if (sourceType === "kutno-simple-catalog") return 70;
  if (sourceType === "kutno-manual-catalog") return 55;
  if (sourceType === "kutno-catalog") return 45;
  if (sourceType === "generated") return -30;
  return 0;
}

function rankRecipes(recipes, body) {
  const context = matchingContext(body);
  return recipes
    .map((recipe) => {
      const analysis = analyzeWithContext(recipe, context);
      const enriched = enrichedWithContext(recipe, context, analysis);
      const usedCount = Array.isArray(enriched.uses) ? enriched.uses.length : 0;
      const rank = analysis.score + verifiedSourceBonus(enriched) + Math.min(18, usedCount * 3) - Number(enriched.minutes || 0) / 120;
      return { recipe: enriched, analysis, rank };
    })
    .filter(({ recipe, analysis }) => recipePassesFilters(recipe, body) && groupAllowed(analysis.group, body.searchMode))
    .sort((first, second) => second.rank - first.rank || Number(first.recipe.minutes) - Number(second.recipe.minutes));
}

function compactMatchedRecipe(recipe) {
  return {
    id: recipe.id,
    compact: true,
    title: recipe.title,
    subtitle: recipe.subtitle,
    cuisine: recipe.cuisine,
    flag: recipe.flag,
    course: recipe.course,
    protein: recipe.protein,
    minutes: recipe.minutes,
    difficulty: recipe.difficulty,
    portions: 2,
    equipment: Array.isArray(recipe.equipment) ? recipe.equipment : [],
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item) => ({
      name: item.name,
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      pantry: item.pantry === true,
      ...(item.role ? { role: item.role } : {}),
    })),
    nutrition: { calories: Number(recipe.nutrition?.calories) || 0 },
    source: recipe.source,
    matching: recipe.matching,
    missing: Array.isArray(recipe.missing) ? recipe.missing : recipe.matching?.missingRequired || [],
    uses: Array.isArray(recipe.uses) ? recipe.uses : [],
    why: recipe.why,
  };
}

function ingredientUnlockSuggestions(catalog, body, limit = 6) {
  const context = matchingContext({ ...body, searchMode: "strict" });
  const owned = new Set(context.ingredients.map(normalizedTitle));
  const counts = new Map();

  for (const recipe of catalog) {
    if (!recipePassesFilters(recipe, { ...body, course: "все", excludeTitles: [] })) continue;
    const analysis = analyzeWithContext(recipe, context);
    if (analysis.missingEquipment?.length) continue;
    if (analysis.requiredMissing?.length !== 1) continue;
    const name = String(analysis.requiredMissing[0]?.name || "").trim();
    const key = normalizedTitle(name);
    if (!name || !key || owned.has(key)) continue;
    const current = counts.get(key) || { name, count: 0 };
    current.count += 1;
    if (name.length < current.name.length) current.name = name;
    counts.set(key, current);
  }

  return [...counts.values()]
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name, "ru"))
    .slice(0, limit);
}

async function runAiIdeas(body, request, env, ctx) {
  const {
    difficulty: ignoredDifficulty,
    maxMinutes: ignoredMaxMinutes,
    portions: ignoredPortions,
    ...unfilteredBody
  } = body;
  const generationBody = {
    ...unfilteredBody,
    portions: 2,
    equipment: [...new Set([...(Array.isArray(body.equipment) ? body.equipment : []), ...MANUAL_EQUIPMENT])],
  };
  const response = await featureWorker.fetch(requestWithJson(request, generationBody), env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data) return { response, data: null, recipes: [] };
  const recipes = Array.isArray(data.recipes) ? rankRecipes(data.recipes, body).map((item) => item.recipe) : [];
  return { response, data, recipes };
}

function resultResponse(recipes, body, { source = "deterministic-catalog", suggestedExpansion = null, suggestions = [], extra = {} } = {}) {
  return json({
    ...extra,
    recipes,
    suggestions,
    hasMore: false,
    source,
    relaxation: null,
    ...(suggestedExpansion ? { suggestedExpansion } : {}),
    originalFilters: {
      searchMode: body.searchMode,
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
        title: "Есть варианты с одной покупкой",
        details: "Можно отдельно показать блюда, где не хватает ровно одного обязательного продукта.",
        count: plusOne.length,
      };
    }
  }
  if (body.course && body.course !== "все") {
    const withoutCourse = rankRecipes(catalog, { ...body, course: "все" });
    if (withoutCourse.length) {
      return {
        code: "relax-filters",
        title: "Подходящие блюда есть в других разделах",
        details: "Продукты и техника останутся прежними; изменится только тип блюда.",
        count: withoutCourse.length,
      };
    }
  }
  return null;
}

function normalizedBody(body = {}) {
  return {
    ...body,
    maxMinutes: 0,
    portions: 2,
    priorityIngredients: [],
    difficulty: undefined,
    searchMode: body.searchMode === "plus-one" ? "plus-one" : "strict",
    course: ["все", "завтрак", "суп", "основное", "перекус"].includes(body.course) ? body.course : "все",
  };
}

async function smartGenerate(request, env, ctx) {
  const incoming = await request.clone().json().catch(() => ({}));
  if (!Array.isArray(incoming.ingredients) || !incoming.ingredients.length) return featureWorker.fetch(request, env, ctx);

  const body = normalizedBody(incoming);
  const catalog = catalogFullRecipes(2);
  const suggestions = ingredientUnlockSuggestions(catalog, body);
  const rankedFull = rankRecipes(catalog, body).map((item) => item.recipe);
  const catalogRanked = rankedFull.map(compactMatchedRecipe);

  if (catalogRanked.length) {
    if (!incoming.aiIdeas) {
      return resultResponse(catalogRanked, body, { suggestions });
    }
    const generated = await runAiIdeas(body, request, env, ctx);
    const combined = mergeRecipes(catalogRanked, generated.recipes);
    return resultResponse(combined, body, {
      source: generated.recipes.length ? "deterministic-plus-ai" : "deterministic-catalog",
      suggestions,
      extra: generated.data || {},
    });
  }

  const suggestedExpansion = expansionSuggestion(body, catalog);
  if (!incoming.aiIdeas) {
    return resultResponse([], body, {
      suggestions,
      suggestedExpansion,
      extra: { error: suggestedExpansion?.title || "Для этого набора пока нет точного рецепта" },
    });
  }

  const generated = await runAiIdeas(body, request, env, ctx);
  if (generated.recipes.length) {
    return resultResponse(generated.recipes, body, {
      source: "workers-ai",
      suggestions,
      extra: generated.data || {},
    });
  }
  if (!generated.data && !generated.response.ok) return generated.response;
  return resultResponse([], body, {
    suggestions,
    suggestedExpansion,
    extra: { error: suggestedExpansion?.title || "Добавьте ещё один основной продукт" },
  });
}

async function matchingSuggestions(request) {
  const url = new URL(request.url);
  const body = normalizedBody({
    ingredients: url.searchParams.getAll("ingredient"),
    equipment: url.searchParams.getAll("equipment"),
    baseIngredients: url.searchParams.getAll("base"),
    course: "все",
    searchMode: "strict",
  });
  if (!body.ingredients.length) return json({ suggestions: [] });
  const suggestions = ingredientUnlockSuggestions(catalogFullRecipes(2), body);
  return json({ suggestions }, 200, { "cache-control": "public, max-age=60, s-maxage=300" });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/generate" && request.method === "POST") return smartGenerate(request, env, ctx);
    if (url.pathname === "/api/matching-suggestions" && request.method === "GET") return matchingSuggestions(request);
    return featureWorker.fetch(request, env, ctx);
  },
};
