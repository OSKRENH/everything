import { db } from '../db/index.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getCachedRecipe(recipeId) {
  const row = db
    .prepare('SELECT payload, fetched_at as fetchedAt FROM recipe_cache WHERE recipe_id = ?')
    .get(recipeId);
  if (!row) return null;
  const age = Date.now() - new Date(row.fetchedAt + 'Z').getTime();
  if (age > TTL_MS) return null;
  return JSON.parse(row.payload);
}

export function setCachedRecipe(recipeId, payload) {
  db.prepare(
    `INSERT INTO recipe_cache (recipe_id, payload, fetched_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(recipe_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
  ).run(recipeId, JSON.stringify(payload));
}
