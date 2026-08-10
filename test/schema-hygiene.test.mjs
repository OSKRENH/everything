import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("runtime-миграция чинит оба строковых user id до обращения к данным", () => {
  const migration = readFileSync("worker/feature-state-migration.js", "utf8");
  const entry = readFileSync("worker/next-entry.js", "utf8");

  assert.match(migration, /user_id TEXT PRIMARY KEY/);
  assert.match(migration, /CAST\(user_id AS TEXT\)/);
  assert.match(migration, /created_by TEXT/);
  assert.match(migration, /CAST\(created_by AS TEXT\)/);
  assert.match(migration, /PRAGMA table_info\(\$\{table\}\)/);
  assert.match(migration, /tableColumns\(env, "user_feature_state"\)/);
  assert.match(migration, /tableColumns\(env, "shared_recipes"\)/);
  assert.match(entry, /url\.pathname === "\/api\/feature-state"/);
  assert.match(entry, /url\.pathname\.startsWith\("\/api\/shared-recipes"\)/);
  assert.match(entry, /await ensureFeatureStateTextSchema\(env\)/);
});
