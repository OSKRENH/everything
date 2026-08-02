import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeFiles = [
  "vite.config.js",
  "worker/entry.js",
  "worker/matching-entry.js",
  "worker/oil-fix-entry.js",
  "worker/manual-recipes.js",
  "src/ingredient-semantics.js",
  "src/ingredient-semantics-v2.js",
  "src/ingredient-semantics-v3.js",
  "src/kutno-bridge.inject.js",
  "src/matching-engine.inject.js",
  "src/matching-fixes.inject.js",
  "public/kutno-features.js",
  "public/dom-stability.js",
  "public/feature-sync-throttle.js",
];

test("runtime-файлы Кутно проходят синтаксическую проверку", () => {
  for (const file of runtimeFiles) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test("сборочный мост подключает API состояния и подбор", () => {
  const bridge = readFileSync("src/kutno-bridge.inject.js", "utf8");
  const matching = readFileSync("src/matching-engine.inject.js", "utf8");
  const fixes = readFileSync("src/matching-fixes.inject.js", "utf8");
  const vite = readFileSync("vite.config.js", "utf8");
  assert.match(bridge, /window\.kutnoBridge\s*=/);
  assert.match(bridge, /restoreSwipeSnapshot/);
  assert.match(bridge, /restoreCookingSession/);
  assert.match(matching, /matchingGroupRecipes/);
  assert.match(matching, /Готовить сейчас/);
  assert.match(matching, /Хочу использовать/);
  assert.match(fixes, /loadCatalog\(true\)/);
  assert.match(vite, /ingredient-semantics-v3/);
});

test("расширенные Worker-слои делегируют основной API", () => {
  const featureWorker = readFileSync("worker/entry.js", "utf8");
  const matchingWorker = readFileSync("worker/matching-entry.js", "utf8");
  const oilFixWorker = readFileSync("worker/oil-fix-entry.js", "utf8");
  const manualCatalog = readFileSync("worker/manual-recipes.js", "utf8");
  assert.match(featureWorker, /return baseWorker\.fetch\(request, env, ctx\)/);
  assert.match(featureWorker, /\/api\/feature-state/);
  assert.match(featureWorker, /shared_recipes/);
  assert.match(matchingWorker, /return featureWorker\.fetch\(request, env, ctx\)/);
  assert.match(matchingWorker, /manualRecipesForPortions/);
  assert.match(oilFixWorker, /return matchingWorker\.fetch\(request, env, ctx\)/);
  assert.match(oilFixWorker, /ingredient-semantics-v3/);
  assert.match(manualCatalog, /kutno-manual-catalog/);
});
