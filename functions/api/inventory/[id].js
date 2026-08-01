import { withErrors } from '../../_shared/apiError.js';
import { requireUserId } from '../../_shared/auth.js';
import { deleteInventoryItem } from '../../_shared/inventory.js';

export const onRequestDelete = withErrors(async ({ request, env, params }) => {
  const userId = await requireUserId(request, env);
  await deleteInventoryItem(env.DB, userId, Number(params.id));
  return new Response(null, { status: 204 });
});
