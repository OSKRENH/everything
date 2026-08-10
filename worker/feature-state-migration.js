let migrationPromise;

async function migrateFeatureStateSchema(env) {
  if (!env?.DB) return;
  const info = await env.DB.prepare("PRAGMA table_info(user_feature_state)").all().catch(() => ({ results: [] }));
  const columns = Array.isArray(info?.results) ? info.results : [];
  const userId = columns.find((column) => String(column?.name || "") === "user_id");
  if (!userId) return;
  if (String(userId.type || "").toUpperCase().includes("TEXT")) return;

  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_feature_state_text_migration (
      user_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`INSERT OR REPLACE INTO user_feature_state_text_migration (user_id, state_json, updated_at)
      SELECT CAST(user_id AS TEXT), state_json, updated_at FROM user_feature_state`),
    env.DB.prepare("DROP TABLE user_feature_state"),
    env.DB.prepare("ALTER TABLE user_feature_state_text_migration RENAME TO user_feature_state"),
  ]);
}

export function ensureFeatureStateTextSchema(env) {
  if (!migrationPromise) {
    migrationPromise = migrateFeatureStateSchema(env).catch((error) => {
      migrationPromise = undefined;
      throw error;
    });
  }
  return migrationPromise;
}
