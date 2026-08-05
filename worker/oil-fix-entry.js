import matchingWorker from "./matching-entry.js";
import { analyzeRecipe, enrichRecipeSemantics } from "../src/ingredient-semantics-v3.js";
import { applyMatchingUserContext, matchingPayloadFromContext } from "../src/matching-user-context.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function contextFromGenerate(body = {}) {
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

function contextFromCatalog(url) {
  return {
    ingredients: url.searchParams.getAll("ingredient"),
    priorityIngredients: url.searchParams.getAll("priority"),
    equipment: url.searchParams.getAll("equipment"),
  };
}

function adjustedAnalysis(recipe, context) {
  return applyMatchingUserContext(recipe, analyzeRecipe(recipe, context), context);
}

function correctedData(data, context) {
  if (!data || !Array.isArray(data.recipes)) return data;
  const recipes = data.recipes
    .map((recipe) => {
      const enriched = enrichRecipeSemantics(recipe, context);
      const analysis = adjustedAnalysis(enriched, context);
      return {
        ...enriched,
        matching: {
          ...(enriched.matching || {}),
          group: analysis.group,
          score: analysis.score,
          reasons: analysis.reasons,
          missingRequired: analysis.requiredMissing.map((item) => item.name),
          quantityShortages: analysis.quantityShortages.map((item) => ({
            name: item.name,
            have: `${item.have.quantity} ${item.have.unit}`.trim(),
            need: item.need,
          })),
          preferencePenalty: analysis.preferencePenalty,
        },
      };
    })
    .sort((first, second) => adjustedAnalysis(second, context).score - adjustedAnalysis(first, context).score);
  return {
    ...data,
    recipes,
    relaxation: null,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isGenerate = url.pathname === "/api/generate" && request.method === "POST";
    const isCatalog = url.pathname === "/api/catalog" && request.method === "GET";
    if (!isGenerate && !isCatalog) return matchingWorker.fetch(request, env, ctx);

    const context = isGenerate
      ? contextFromGenerate(await request.clone().json().catch(() => ({})))
      : contextFromCatalog(url);
    const response = await matchingWorker.fetch(request, env, ctx);
    const data = await response.clone().json().catch(() => null);
    if (!data) return response;
    return json(correctedData(data, context), response.status);
  },
};
