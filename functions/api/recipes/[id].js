import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { getRecipeDetail } from '../../_shared/recipeMatching.js';

export const onRequestPost = withErrors(async ({ request, env, params }) => {
  const { equipment } = (await request.json().catch(() => ({}))) ?? {};
  const detail = await getRecipeDetail(env.DB, env.SPOONACULAR_API_KEY, equipment, Number(params.id));
  return jsonResponse(detail);
});
