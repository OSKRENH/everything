import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { searchRecipes } from '../../_shared/recipeMatching.js';

export const onRequestPost = withErrors(async ({ request, env }) => {
  const { ingredients, number } = (await request.json().catch(() => ({}))) ?? {};
  const candidates = await searchRecipes(env.SPOONACULAR_API_KEY, ingredients, number || 10);
  return jsonResponse({ candidates });
});
