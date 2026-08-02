import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeFiles = [
  "vite.config.js",
  "worker/entry.js",
  "src/kutno-bridge.inject.js",
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

test("сборочный мост подключает API состояния", () => {
  const source = readFileSync("src/kutno-bridge.inject.js", "utf8");
  assert.match(source, /window\.kutnoBridge\s*=/);
  assert.match(source, /restoreSwipeSnapshot/);
  assert.match(source, /restoreCookingSession/);
});

test("расширенный Worker делегирует основной API", () => {
  const source = readFileSync("worker/entry.js", "utf8");
  assert.match(source, /return baseWorker\.fetch\(request, env, ctx\)/);
  assert.match(source, /\/api\/feature-state/);
  assert.match(source, /shared_recipes/);
});
