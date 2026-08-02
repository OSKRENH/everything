import {
  DEFAULT_BASE_INGREDIENTS,
  SUGGESTED_BASE_INGREDIENTS,
  MANUAL_EQUIPMENT,
  analyzeRecipe as baseAnalyzeRecipe,
  enrichRecipeSemantics as baseEnrichRecipeSemantics,
  ingredientMatch as baseIngredientMatch,
  ingredientRole,
  normalizeIngredient,
} from "./ingredient-semantics-v2.js";

function normalizedOilName(value = "") {
  const normalized = normalizeIngredient(value);
  if (/^масло(?:\s+(?:для\s+)?(?:жарки|обжарки|обжаривания))?$/.test(normalized)) {
    return "растительное масло";
  }
  return value;
}

function transformedRecipe(recipe) {
  return {
    ...recipe,
    ingredients: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => ({
      ...item,
      name: normalizedOilName(item?.name),
      aliases: (Array.isArray(item?.aliases) ? item.aliases : []).map(normalizedOilName),
    })),
  };
}

function transformedContext(context = {}) {
  return {
    ...context,
    ingredients: (Array.isArray(context.ingredients) ? context.ingredients : []).map(normalizedOilName),
    priorityIngredients: (Array.isArray(context.priorityIngredients) ? context.priorityIngredients : []).map(normalizedOilName),
    baseIngredients: (Array.isArray(context.baseIngredients) ? context.baseIngredients : DEFAULT_BASE_INGREDIENTS).map(normalizedOilName),
  };
}

function restoreAnalysisNames(recipe, analysis) {
  const originals = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const ingredients = analysis.ingredients.map((item, index) => ({
    ...item,
    name: originals[index]?.name || item.name,
    aliases: originals[index]?.aliases || item.aliases,
  }));
  const restored = (items) => items.map((item) => ingredients[analysis.ingredients.indexOf(item)] || item);
  return {
    ...analysis,
    recipe,
    ingredients,
    requiredMissing: restored(analysis.requiredMissing),
    optionalMissing: restored(analysis.optionalMissing),
    substitutions: restored(analysis.substitutions),
    exactAvailable: restored(analysis.exactAvailable),
  };
}

export function ingredientMatch(recipeIngredient, ownedIngredient) {
  return baseIngredientMatch(normalizedOilName(recipeIngredient), normalizedOilName(ownedIngredient));
}

export function analyzeRecipe(recipe, context = {}) {
  return restoreAnalysisNames(
    recipe,
    baseAnalyzeRecipe(transformedRecipe(recipe), transformedContext(context)),
  );
}

export function enrichRecipeSemantics(recipe, context = {}) {
  const analysis = analyzeRecipe(recipe, context);
  return {
    ...recipe,
    ingredients: analysis.ingredients.map(({ match, ...item }) => ({
      ...item,
      matchType: match?.type || "none",
      matchedOwned: match?.owned || "",
    })),
    matching: {
      group: analysis.group,
      score: analysis.score,
      reasons: analysis.reasons,
      missingRequired: analysis.requiredMissing.map((item) => item.name),
      missingOptional: analysis.optionalMissing.map((item) => item.name),
      substitutions: analysis.substitutions.map((item) => ({
        ingredient: item.name,
        owned: item.match?.owned || "",
      })),
      missingEquipment: analysis.missingEquipment,
      priorityHits: analysis.priorityHits,
    },
  };
}

export {
  DEFAULT_BASE_INGREDIENTS,
  SUGGESTED_BASE_INGREDIENTS,
  MANUAL_EQUIPMENT,
  ingredientRole,
  normalizeIngredient,
};
