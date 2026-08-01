const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function getCachedRecipe(db, recipeId) {
  const row = await db
    .prepare('SELECT payload, fetched_at as fetchedAt FROM recipe_cache WHERE recipe_id = ?')
    .bind(recipeId)
    .first();
  if (!row) return null;
  const age = Date.now() - new Date(row.fetchedAt + 'Z').getTime();
  if (age > TTL_MS) return null;
  return JSON.parse(row.payload);
}

export async function setCachedRecipe(db, recipeId, payload) {
  await db
    .prepare(
      `INSERT INTO recipe_cache (recipe_id, payload, fetched_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(recipe_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    )
    .bind(recipeId, JSON.stringify(payload))
    .run();
}
