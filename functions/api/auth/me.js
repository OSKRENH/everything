import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { requireUserId } from '../../_shared/auth.js';
import { getUserById } from '../../_shared/users.js';

export const onRequestGet = withErrors(async ({ request, env }) => {
  const userId = await requireUserId(request, env);
  const user = await getUserById(env.DB, userId);
  return jsonResponse(user);
});
