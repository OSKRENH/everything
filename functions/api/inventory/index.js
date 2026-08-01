import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { requireUserId } from '../../_shared/auth.js';
import { listInventory, addInventoryItem } from '../../_shared/inventory.js';

export const onRequestGet = withErrors(async ({ request, env }) => {
  const userId = await requireUserId(request, env);
  return jsonResponse(await listInventory(env.DB, userId));
});

export const onRequestPost = withErrors(async ({ request, env }) => {
  const userId = await requireUserId(request, env);
  const { type, name } = (await request.json().catch(() => ({}))) ?? {};
  const item = await addInventoryItem(env.DB, userId, type, name);
  return jsonResponse(item, { status: 201 });
});
