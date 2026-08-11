import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("клиент и Worker используют одно ядро запасов", () => {
  const vite = readFileSync("vite.config.js", "utf8");
  const client = readFileSync("src/matching-core-v4.inject.js", "utf8");
  const worker = readFileSync("worker/matching-entry.js", "utf8");
  const next = readFileSync("worker/next-entry.js", "utf8");
  const routes = readFileSync("worker/routes.js", "utf8");

  assert.match(vite, /matching-user-context\.js/);
  assert.match(vite, /matching-core-v4\.inject\.js/);
  assert.match(client, /matchingApplyUserContext/);
  assert.match(client, /pantry: userContext\.pantry/);
  assert.match(client, /feedback: userContext\.feedback/);
  assert.match(worker, /ingredient-semantics-v3\.js/);
  assert.doesNotMatch(worker, /ingredient-semantics-v2\.js/);
  assert.match(worker, /applyMatchingUserContext/);
  assert.match(next, /dispatchRoute/);
  assert.match(routes, /matchingWorkerModulePromise\s*\|\|=\s*import\("\.\/matching-entry\.js"\)/);
  assert.match(routes, /const toMatching = .*matchingWorkerFetch/);
  assert.match(routes, /exact\("\/api\/generate"[^\n]*toMatching/);
  assert.doesNotMatch(next, /oil-fix-entry|safe-entry/);
});

test("близкие варианты показываются сразу вместо скрытого режима расширения", () => {
  const worker = readFileSync("worker/matching-entry.js", "utf8");
  const audit = readFileSync("src/audit-v7.inject.js", "utf8");
  assert.match(worker, /analysis\.requiredMissing\?\.length \|\| 0\) <= 3/);
  assert.doesNotMatch(worker, /suggestedExpansion/);
  assert.match(audit, /Готовьте сейчас/);
  assert.match(audit, /Купить один продукт/);
  assert.match(audit, /Почти подходит/);
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
