import {
  DEFAULT_BASE_INGREDIENTS,
  analyzeRecipe as baseAnalyzeRecipe,
  enrichRecipeSemantics as baseEnrichRecipeSemantics,
  ingredientMatch as baseIngredientMatch,
  ingredientRole,
  normalizeIngredient,
} from "./ingredient-semantics.js";

const SPECIAL_INGREDIENTS = new Map([
  ["кокосовое молоко", "special:coconut-milk"],
  ["кокосовые сливки", "special:coconut-cream"],
  ["сгущенное молоко", "special:condensed-milk"],
  ["сгущённое молоко", "special:condensed-milk"],
  ["сухое молоко", "special:milk-powder"],
]);

const SPECIAL_LABELS = {
  "special:coconut-milk": "кокосовое молоко",
  "special:coconut-cream": "кокосовые сливки",
  "special:condensed-milk": "сгущённое молоко",
  "special:milk-powder": "сухое молоко",
};

function semanticValue(value = "") {
  return SPECIAL_INGREDIENTS.get(normalizeIngredient(value)) || value;
}

function restoreText(value = "") {
  let result = String(value);
  for (const [marker, label] of Object.entries(SPECIAL_LABELS)) result = result.replaceAll(marker, label);
  return result;
}

function transformedRecipe(recipe) {
  return {
    ...recipe,
    ingredients: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => ({
      ...item,
      name: semanticValue(item?.name),
      aliases: (Array.isArray(item?.aliases) ? item.aliases : []).map(semanticValue),
    })),
  };
}

function transformedContext(context = {}) {
  const equipmentProvided = Array.isArray(context.equipment);
  return {
    ...context,
    ingredients: (Array.isArray(context.ingredients) ? context.ingredients : []).map(semanticValue),
    priorityIngredients: (Array.isArray(context.priorityIngredients) ? context.priorityIngredients : []).map(semanticValue),
    baseIngredients: (Array.isArray(context.baseIngredients) ? context.baseIngredients : DEFAULT_BASE_INGREDIENTS).map(semanticValue),
    equipment: equipmentProvided && context.equipment.length === 0 ? ["__нет техники__"] : context.equipment,
  };
}

export function ingredientMatch(recipeIngredient, ownedIngredient) {
  return baseIngredientMatch(semanticValue(recipeIngredient), semanticValue(ownedIngredient));
}

export function analyzeRecipe(recipe, context = {}) {
  const originalIngredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const analysis = baseAnalyzeRecipe(transformedRecipe(recipe), transformedContext(context));
  const ingredients = analysis.ingredients.map((item, index) => ({
    ...item,
    name: originalIngredients[index]?.name || restoreText(item.name),
    aliases: originalIngredients[index]?.aliases || item.aliases,
    match: item.match ? {
      ...item.match,
      owned: restoreText(item.match.owned || ""),
      replacement: restoreText(item.match.replacement || ""),
    } : item.match,
  }));
  const byName = (items) => items.map((item) => ingredients[item._semanticIndex ?? analysis.ingredients.indexOf(item)] || item);
  const requiredMissing = byName(analysis.requiredMissing);
  const optionalMissing = byName(analysis.optionalMissing);
  const substitutions = byName(analysis.substitutions);
  const exactAvailable = byName(analysis.exactAvailable);
  return {
    ...analysis,
    recipe,
    ingredients,
    requiredMissing,
    optionalMissing,
    substitutions,
    exactAvailable,
    priorityHits: analysis.priorityHits.map(restoreText),
    reasons: analysis.reasons.map(restoreText),
  };
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
      substitutions: analysis.substitutions.map((item) => ({ ingredient: item.name, owned: item.match?.owned || "" })),
      missingEquipment: analysis.missingEquipment,
      priorityHits: analysis.priorityHits,
    },
  };
}

export { DEFAULT_BASE_INGREDIENTS, ingredientRole, normalizeIngredient };
