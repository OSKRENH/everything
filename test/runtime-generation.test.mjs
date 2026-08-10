import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("тяжёлые источники рецептов остаются только build-time, а Worker читает generated runtime", () => {
  const baseWorker = readFileSync("worker/index.js", "utf8");
  const catalog = readFileSync("worker/catalog-page.js", "utf8");
  const matching = readFileSync("worker/matching-entry.js", "utf8");
  const authoring = readFileSync("scripts/catalog-source.mjs", "utf8");
  const generator = readFileSync("scripts/generate-recipe-runtime.mjs", "utf8");

  for (const runtime of [baseWorker, catalog, matching]) {
    assert.doesNotMatch(runtime, /recipe-catalog\.js|simple-recipes\.js|home-recipes-expanded\.js|home-recipes-finish\.js|manual-recipes\.js/);
  }
  assert.match(baseWorker, /generated\/catalog-runtime\.js/);
  assert.match(baseWorker, /generated\/glossary-runtime\.js/);
  assert.match(catalog, /generated\/catalog-runtime\.js/);
  assert.match(matching, /generated\/catalog-runtime\.js/);

  assert.match(authoring, /recipe-catalog\.js/);
  assert.match(authoring, /simple-recipes\.js/);
  assert.match(authoring, /home-recipes-expanded\.js/);
  assert.match(authoring, /home-recipes-finish\.js/);
  assert.match(authoring, /manual-recipes\.js/);
  assert.match(generator, /\.\/catalog-source\.mjs/);
});
