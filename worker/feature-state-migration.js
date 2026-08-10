let migrationPromise;

async function tableColumns(env, table) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all().catch(() => ({ results: [] }));
  return Array.isArray(info?.results) ? info.results : [];
}

function columnIsText(columns, name) {
  const column = columns.find((item) => String(item?.name || "") === name);
  return column ? String(column.type || "").toUpperCase().includes("TEXT") : true;
}

async function migrateFeatureStateSchema(env) {
  const columns = await tableColumns(env, "user_feature_state");
  if (!columns.length || columnIsText(columns, "user_id")) return;

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

async function migrateSharedRecipesSchema(env) {
  const columns = await tableColumns(env, "shared_recipes");
  if (!columns.length || columnIsText(columns, "created_by")) return;

  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS shared_recipes_text_migration (
      id TEXT PRIMARY KEY,
      recipe_json TEXT NOT NULL,
      created_by TEXT,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`INSERT OR REPLACE INTO shared_recipes_text_migration (id, recipe_json, created_by, created_at)
      SELECT id, recipe_json, CAST(created_by AS TEXT), created_at FROM shared_recipes`),
    env.DB.prepare("DROP TABLE shared_recipes"),
    env.DB.prepare("ALTER TABLE shared_recipes_text_migration RENAME TO shared_recipes"),
  ]);
}

async function migrateUserDataSchemas(env) {
  if (!env?.DB) return;
  await migrateFeatureStateSchema(env);
  await migrateSharedRecipesSchema(env);
}

export function ensureFeatureStateTextSchema(env) {
  if (!migrationPromise) {
    migrationPromise = migrateUserDataSchemas(env).catch((error) => {
      migrationPromise = undefined;
      throw error;
    });
  }
  return migrationPromise;
}
