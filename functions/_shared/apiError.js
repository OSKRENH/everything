export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export function errorResponse(err) {
  if (err instanceof ApiError) {
    return jsonResponse({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error(err);
  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера.' } },
    { status: 500 },
  );
}

export function withErrors(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
