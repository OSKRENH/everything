import { verifyToken } from './jwt.js';
import { ApiError } from './apiError.js';

export async function requireUserId(request, env) {
  const header = request.headers.get('Authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация.');
  }
  try {
    const payload = await verifyToken(token, env.JWT_SECRET);
    return Number(payload.sub);
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Недействительный или истёкший токен.');
  }
}
