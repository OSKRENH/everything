import {
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

export const DEFAULT_BASE_INGREDIENTS = [
  "соль",
  "вода",
  "растительное масло",
  "сахар",
];

export const SUGGESTED_BASE_INGREDIENTS = [
  ...DEFAULT_BASE_INGREDIENTS,
  "чёрный перец",
  "пшеничная мука",
  "уксус",
];

export const MANUAL_EQUIPMENT = [
  "руки",
  "нож",
  "разделочная доска",
  "миска",
  "ложка",
  "вилка",
];

function semanticValue(value = "") {
  return SPECIAL_INGREDIENTS.get(normalizeIngredient(value)) || value;
}

function restoreText(value = "") {
  let result = String(value);
  for (const [marker, label] of Object.entries(SPECIAL_LABELS)) result = result.replaceAll(marker, label);
  return result;
}

function selectedBaseMatch(name, baseIngredients) {
  let best = { type: "none" };
  for (const base of baseIngredients) {
    const match = baseIngredientMatch(semanticValue(name), semanticValue(base));
    const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
    if (rank[match.type] > rank[best.type]) best = match;
  }
  return best;
}

function transformedRecipe(recipe, baseIngredients) {
  return {
    ...recipe,
    ingredients: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => {
      const name = semanticValue(item?.name);
      const normalized = normalizeIngredient(item?.name);
      const baseMatch = selectedBaseMatch(item?.name, baseIngredients);
      let role = item?.role;
      let pantry = item?.pantry;

      if (["exact", "category"].includes(baseMatch.type)) {
        role = "base";
        pantry = true;
      } else if (/оливков.*масл/.test(normalized)) {
        role = item?.role === "optional" ? "optional" : "required";
        pantry = false;
      } else if (/черн.*перец|перец.*черн/.test(normalized)) {
        role = "optional";
        pantry = false;
      } else if (/сахар|мук|уксус/.test(normalized)) {
        pantry = false;
        if (role === "base") role = undefined;
      }

      return {
        ...item,
        name,
        role,
        pantry,
        aliases: (Array.isArray(item?.aliases) ? item.aliases : []).map(semanticValue),
      };
    }),
  };
}

function transformedContext(context = {}) {
  const selectedEquipment = Array.isArray(context.equipment) ? context.equipment : [];
  const baseIngredients = Array.isArray(context.baseIngredients) ? context.baseIngredients : DEFAULT_BASE_INGREDIENTS;
  const ownedIngredients = Array.isArray(context.ingredients) ? context.ingredients : [];
  return {
    ...context,
    ingredients: [...new Set([...ownedIngredients, ...baseIngredients])].map(semanticValue),
    priorityIngredients: (Array.isArray(context.priorityIngredients) ? context.priorityIngredients : []).map(semanticValue),
    baseIngredients: baseIngredients.map(semanticValue),
    equipment: [...new Set([...MANUAL_EQUIPMENT, ...selectedEquipment])],
  };
}

export function ingredientMatch(recipeIngredient, ownedIngredient) {
  return baseIngredientMatch(semanticValue(recipeIngredient), semanticValue(ownedIngredient));
}

export function analyzeRecipe(recipe, context = {}) {
  const originalIngredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const baseIngredients = Array.isArray(context.baseIngredients) ? context.baseIngredients : DEFAULT_BASE_INGREDIENTS;
  const analysis = baseAnalyzeRecipe(transformedRecipe(recipe, baseIngredients), transformedContext(context));
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

export { ingredientRole, normalizeIngredient };
