import { jsonResponse } from '../_shared/apiError.js';

export const onRequest = () =>
  jsonResponse({ error: { code: 'NOT_FOUND', message: 'Маршрут не найден.' } }, { status: 404 });
