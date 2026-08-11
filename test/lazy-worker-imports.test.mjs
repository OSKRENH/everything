import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routes = readFileSync("worker/routes.js", "utf8");
const matcher = readFileSync("worker/matching-entry.js", "utf8");
const builder = readFileSync("scripts/build-worker.mjs", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");

test("тяжёлые Worker-модули не входят статически в общий startup graph", () => {
  assert.doesNotMatch(routes, /^import\s+.*from\s+["']\.\/index\.js["']/m);
  assert.doesNotMatch(routes, /^import\s+.*from\s+["']\.\/entry\.js["']/m);
  assert.doesNotMatch(routes, /^import\s+.*from\s+["']\.\/matching-entry\.js["']/m);
  assert.match(routes, /import\(["']\.\/index\.js["']\)/);
  assert.match(routes, /import\(["']\.\/entry\.js["']\)/);
  assert.match(routes, /import\(["']\.\/matching-entry\.js["']\)/);
});

test("обычный matcher не загружает AI/auth worker до запроса aiIdeas или fallback", () => {
  assert.doesNotMatch(matcher, /^import\s+.*from\s+["']\.\/entry\.js["']/m);
  assert.match(matcher, /featureWorkerModulePromise\s*\|\|=\s*import\(["']\.\/entry\.js["']\)/);
});

test("prebundle сохраняет dynamic imports отдельными ESM chunks", () => {
  assert.match(builder, /splitting:\s*true/);
  assert.match(builder, /outExtension:\s*\{\s*["']\.js["']:\s*["']\.mjs["']\s*\}/);
  assert.match(wrangler, /"main"\s*:\s*"\.worker-build\/index\.mjs"/);
  assert.match(wrangler, /"find_additional_modules"\s*:\s*true/);
  assert.match(wrangler, /"type"\s*:\s*"ESModule"/);
  assert.match(wrangler, /"\*\*\/\*\.mjs"/);
});
