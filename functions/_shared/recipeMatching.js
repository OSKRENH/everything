import { ApiError } from './apiError.js';
import { findByIngredients, getRecipeInformation } from './spoonacular.js';
import { getCachedRecipe, setCachedRecipe } from './recipeCache.js';

export async function searchRecipes(apiKey, ingredients, number = 10) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new ApiError(400, 'NO_INGREDIENTS', 'Добавьте хотя бы один продукт в инвентарь.');
  }

  const results = await findByIngredients(apiKey, ingredients, number);

  return results.map((r) => {
    const used = r.usedIngredientCount ?? r.usedIngredients?.length ?? 0;
    const missed = r.missedIngredientCount ?? r.missedIngredients?.length ?? 0;
    const total = used + missed;
    return {
      id: r.id,
      title: r.title,
      image: r.image,
      usedIngredientCount: used,
      missedIngredientCount: missed,
      matchPercent: total > 0 ? Math.round((used / total) * 100) : 0,
      usedIngredients: (r.usedIngredients ?? []).map((i) => ({ id: i.id, name: i.name })),
      missedIngredients: (r.missedIngredients ?? []).map((i) => ({ id: i.id, name: i.name })),
    };
  });
}

function normalize(name) {
  return name.trim().toLowerCase();
}

export async function getRecipeDetail(db, apiKey, equipment, recipeId) {
  let info = await getCachedRecipe(db, recipeId);
  if (!info) {
    info = await getRecipeInformation(apiKey, recipeId);
    await setCachedRecipe(db, recipeId, info);
  }

  const steps = info.analyzedInstructions?.[0]?.steps ?? [];
  const requiredEquipmentSet = new Set();
  for (const step of steps) {
    for (const eq of step.equipment ?? []) {
      requiredEquipmentSet.add(eq.name);
    }
  }

  const userEquipment = new Set((equipment ?? []).map(normalize));
  const missingEquipment = [...requiredEquipmentSet].filter((eq) => !userEquipment.has(normalize(eq)));
  const missingSet = new Set(missingEquipment.map(normalize));

  return {
    id: info.id,
    title: info.title,
    image: info.image,
    servings: info.servings,
    readyInMinutes: info.readyInMinutes,
    requiredEquipment: [...requiredEquipmentSet],
    missingEquipment,
    steps: steps.map((step) => ({
      number: step.number,
      step: step.step,
      ingredients: (step.ingredients ?? []).map((i) => ({ id: i.id, name: i.name })),
      equipment: (step.equipment ?? []).map((eq) => ({
        name: eq.name,
        missing: missingSet.has(normalize(eq.name)),
      })),
    })),
  };
}
