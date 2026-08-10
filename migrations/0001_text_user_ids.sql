-- Кутно: привести пользовательские внешние ключи к TEXT.
-- Миграция намеренно безопасна и для уже исправленной runtime-миграцией схемы:
-- она пересоздаёт таблицы с целевыми типами и сохраняет данные.

DROP TABLE IF EXISTS user_feature_state_old;
CREATE TABLE IF NOT EXISTS user_feature_state (
  user_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
ALTER TABLE user_feature_state RENAME TO user_feature_state_old;
CREATE TABLE user_feature_state (
  user_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO user_feature_state (user_id, state_json, updated_at)
SELECT CAST(user_id AS TEXT), state_json, updated_at
FROM user_feature_state_old;
DROP TABLE user_feature_state_old;

DROP TABLE IF EXISTS shared_recipes_old;
CREATE TABLE IF NOT EXISTS shared_recipes (
  id TEXT PRIMARY KEY,
  recipe_json TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
ALTER TABLE shared_recipes RENAME TO shared_recipes_old;
CREATE TABLE shared_recipes (
  id TEXT PRIMARY KEY,
  recipe_json TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
INSERT INTO shared_recipes (id, recipe_json, created_by, created_at)
SELECT id, recipe_json, CAST(created_by AS TEXT), created_at
FROM shared_recipes_old;
DROP TABLE shared_recipes_old;
