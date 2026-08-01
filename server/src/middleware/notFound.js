export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Маршрут не найден.' } });
}
