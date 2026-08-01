import { withErrors, jsonResponse } from '../../_shared/apiError.js';
import { ApiError } from '../../_shared/apiError.js';
import { verifyGoogleIdToken } from '../../_shared/googleAuth.js';
import { findOrCreateGoogleUser } from '../../_shared/users.js';
import { signToken } from '../../_shared/jwt.js';

export const onRequestPost = withErrors(async ({ request, env }) => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, 'GOOGLE_LOGIN_UNAVAILABLE', 'Вход через Google временно недоступен.');
  }
  const { credential } = (await request.json().catch(() => ({}))) ?? {};
  if (!credential) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Отсутствует токен Google.');
  }

  const { email, emailVerified } = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
  if (!emailVerified) {
    throw new ApiError(401, 'GOOGLE_EMAIL_UNVERIFIED', 'Email в Google-аккаунте не подтверждён.');
  }

  const user = await findOrCreateGoogleUser(env.DB, email);
  const token = await signToken({ sub: String(user.id) }, env.JWT_SECRET);
  return jsonResponse({ token, user });
});
