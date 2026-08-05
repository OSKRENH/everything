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

const COMMON_INGREDIENT_ALIASES = new Map([
  ["репчатая луковица", "репчатый лук"],
  ["луковица", "репчатый лук"],
  ["зубчик чеснока", "чеснок"],
  ["зубчики чеснока", "чеснок"],
  ["макаронные изделия", "макароны"],
  ["длиннозерный рис", "рис"],
  ["длиннозернистый рис", "рис"],
  ["рис длиннозерный", "рис"],
  ["томаты черри", "помидоры"],
  ["помидоры черри", "помидоры"],
  ["томат черри", "помидоры"],
  ["филе лосося", "лосось"],
  ["филе семги", "лосось"],
  ["филе семги", "лосось"],
  ["семга", "лосось"],
  ["семга слабосоленая", "лосось"],
  ["красная рыба", "лосось"],
  ["говяжий фарш", "фарш из говядины"],
  ["фарш говяжий", "фарш из говядины"],
  ["свиной фарш", "фарш из свинины"],
  ["фарш свиной", "фарш из свинины"],
  ["куриный фарш", "фарш из курицы"],
  ["фарш куриный", "фарш из курицы"],
  ["консервированный тунец", "тунец"],
  ["тунец консервированный", "тунец"],
  ["шампиньоны свежие", "шампиньоны"],
  ["свежие шампиньоны", "шампиньоны"],
]);

function normalizedCommonName(value = "") {
  const normalized = normalizeIngredient(value);
  if (/^масло(?:\s+(?:для\s+)?(?:жарки|обжарки|обжаривания))?$/.test(normalized)) return "растительное масло";
  if (COMMON_INGREDIENT_ALIASES.has(normalized)) return COMMON_INGREDIENT_ALIASES.get(normalized);
  const withoutPreparation = normalized
    .replace(/^(?:свежий|свежая|свежие|замороженный|замороженная|замороженные|охлажденный|охлажденная|очищенный|очищенная)\s+/u, "")
    .replace(/\s+(?:свежий|свежая|свежие|замороженный|замороженная|замороженные|охлажденный|охлажденная|очищенный|очищенная)$/u, "")
    .trim();
  return COMMON_INGREDIENT_ALIASES.get(withoutPreparation) || withoutPreparation || normalized;
}

function transformedRecipe(recipe) {
  return {
    ...recipe,
    ingredients: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => ({
      ...item,
      name: normalizedCommonName(item?.name),
      aliases: (Array.isArray(item?.aliases) ? item.aliases : []).map(normalizedCommonName),
    })),
  };
}

function transformedContext(context = {}) {
  return {
    ...context,
    ingredients: (Array.isArray(context.ingredients) ? context.ingredients : []).map(normalizedCommonName),
    priorityIngredients: (Array.isArray(context.priorityIngredients) ? context.priorityIngredients : []).map(normalizedCommonName),
    baseIngredients: (Array.isArray(context.baseIngredients) ? context.baseIngredients : DEFAULT_BASE_INGREDIENTS).map(normalizedCommonName),
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
  const required = normalizedCommonName(recipeIngredient);
  const owned = normalizedCommonName(ownedIngredient);
  const direct = baseIngredientMatch(required, owned);
  if (direct.type !== "none") return direct;

  if (/лосос/.test(required) && /лосос/.test(owned)) return { type: "exact", owned: ownedIngredient };
  if (/фарш из говядин/.test(required) && /(?:фарш.*говядин|говядин.*фарш)/.test(owned)) return { type: "exact", owned: ownedIngredient };
  if (/фарш из свинин/.test(required) && /(?:фарш.*свинин|свинин.*фарш)/.test(owned)) return { type: "exact", owned: ownedIngredient };
  if (/фарш из куриц/.test(required) && /(?:фарш.*куриц|куриц.*фарш)/.test(owned)) return { type: "exact", owned: ownedIngredient };
  return direct;
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
