import matchingWorker from "./matching-entry.js";
import { analyzeRecipe, enrichRecipeSemantics } from "../src/ingredient-semantics-v3.js";

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
  return {
    ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
    priorityIngredients: Array.isArray(body.priorityIngredients) ? body.priorityIngredients : [],
    equipment: Array.isArray(body.equipment) ? body.equipment : [],
    baseIngredients: Array.isArray(body.baseIngredients) ? body.baseIngredients : undefined,
  };
}

function contextFromCatalog(url) {
  return {
    ingredients: url.searchParams.getAll("ingredient"),
    priorityIngredients: url.searchParams.getAll("priority"),
    equipment: url.searchParams.getAll("equipment"),
  };
}

function correctedData(data, context) {
  if (!data || !Array.isArray(data.recipes)) return data;
  const recipes = data.recipes
    .map((recipe) => enrichRecipeSemantics(recipe, context))
    .sort((first, second) => analyzeRecipe(second, context).score - analyzeRecipe(first, context).score);
  const groups = recipes.map((recipe) => analyzeRecipe(recipe, context).group);
  const relaxation = data.relaxation?.code === "allow-one-purchase"
    && groups.every((group) => ["ready", "substitute"].includes(group))
      ? null
      : data.relaxation;
  return {
    ...data,
    recipes,
    ...(relaxation ? { relaxation } : { relaxation: null }),
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
