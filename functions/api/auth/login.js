import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { authenticateUser } from '../../_shared/users.js';
import { signToken } from '../../_shared/jwt.js';

export const onRequestPost = withErrors(async ({ request, env }) => {
  const { email, password } = (await request.json().catch(() => ({}))) ?? {};
  const user = await authenticateUser(env.DB, email, password);
  const token = await signToken({ sub: String(user.id) }, env.JWT_SECRET);
  return jsonResponse({ token, user });
});
