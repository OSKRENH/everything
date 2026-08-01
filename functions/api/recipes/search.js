import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { requireUserId } from '../../_shared/auth.js';
import { searchRecipes } from '../../_shared/recipeMatching.js';

export const onRequestGet = withErrors(async ({ request, env }) => {
  const userId = await requireUserId(request, env);
  const url = new URL(request.url);
  const number = url.searchParams.get('number') ? Number(url.searchParams.get('number')) : 10;
  const candidates = await searchRecipes(env.DB, env.SPOONACULAR_API_KEY, userId, number);
  return jsonResponse({ candidates });
});
