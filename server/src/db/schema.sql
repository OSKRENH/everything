CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('ingredient', 'equipment')),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, type, name)
);
CREATE INDEX IF NOT EXISTS idx_inventory_user_type ON inventory_items(user_id, type);

-- Caches Spoonacular /recipes/{id}/information payloads to conserve the free-tier daily quota.
CREATE TABLE IF NOT EXISTS recipe_cache (
  recipe_id  INTEGER PRIMARY KEY,
  payload    TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
