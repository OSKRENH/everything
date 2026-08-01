import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { requireUserId } from '../../_shared/auth.js';
import { getRecipeDetail } from '../../_shared/recipeMatching.js';

export const onRequestGet = withErrors(async ({ request, env, params }) => {
  const userId = await requireUserId(request, env);
  const detail = await getRecipeDetail(env.DB, env.SPOONACULAR_API_KEY, userId, Number(params.id));
  return jsonResponse(detail);
});
