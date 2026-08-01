import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './apiError.js';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdToken(credential, clientId) {
  let payload;
  try {
    ({ payload } = await jwtVerify(credential, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    }));
  } catch {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Не удалось подтвердить вход через Google.');
  }
  return {
    email: payload.email,
    emailVerified: payload.email_verified === true,
  };
}
