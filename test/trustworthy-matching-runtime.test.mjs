import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("клиент и Worker используют одно ядро запасов", () => {
  const vite = readFileSync("vite.config.js", "utf8");
  const client = readFileSync("src/matching-core-v4.inject.js", "utf8");
  const worker = readFileSync("worker/matching-entry.js", "utf8");
  const finalWorker = readFileSync("worker/oil-fix-entry.js", "utf8");

  assert.match(vite, /matching-user-context\.js/);
  assert.match(vite, /matching-core-v4\.inject\.js/);
  assert.match(client, /matchingApplyUserContext/);
  assert.match(client, /pantry: userContext\.pantry/);
  assert.match(client, /feedback: userContext\.feedback/);
  assert.match(worker, /ingredient-semantics-v3\.js/);
  assert.doesNotMatch(worker, /ingredient-semantics-v2\.js/);
  assert.match(worker, /applyMatchingUserContext/);
  assert.match(finalWorker, /applyMatchingUserContext/);
});

test("строгий режим предлагает расширение, но не включает его автоматически", () => {
  const worker = readFileSync("worker/matching-entry.js", "utf8");
  const client = readFileSync("src/matching-core-v4.inject.js", "utf8");
  assert.match(worker, /suggestedExpansion/);
  assert.match(worker, /code: "allow-one-purchase"/);
  assert.match(worker, /if \(body\.searchMode !== "plus-one"\)/);
  assert.match(client, /data-matching-expand/);
  assert.match(client, /state\.searchMode = "plus-one"/);
});

test("локальный каталог используется только при ошибке запроса", () => {
  const client = readFileSync("src/matching-core-v4.inject.js", "utf8");
  const tryIndex = client.indexOf("try {");
  const catchIndex = client.indexOf("} catch (error)", tryIndex);
  const fallbackIndex = client.indexOf("fallbackRecipesForRequestV4()", tryIndex);
  assert.ok(catchIndex > tryIndex);
  assert.ok(fallbackIndex > catchIndex, "резервные рецепты должны появляться только внутри catch");
  assert.match(client, /const incoming = mergeUniqueRecipes\(\[\], data\.recipes/);
});
