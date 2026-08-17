import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceWorker = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../src/bootstrap.js", import.meta.url), "utf8");

test("Service Worker не возвращает устаревший полный app shell при сбое навигации", () => {
  assert.match(serviceWorker, /kutno-resilient-v4/);
  assert.match(serviceWorker, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.match(serviceWorker, /cache\.match\(FALLBACK_URL\)/);
  assert.doesNotMatch(serviceWorker, /cache\.match\(request\) \|\| await cache\.match\(FALLBACK_URL\)/);
  assert.doesNotMatch(serviceWorker, /cache\.add\("\/"\)/);
});

test("клиент принудительно проверяет свежий sw.js и один раз перезагружается после смены контроллера", () => {
  assert.match(bootstrap, /updateViaCache: "none"/);
  assert.match(bootstrap, /registration\.update\(\)/);
  assert.match(bootstrap, /serviceWorker\.addEventListener\("controllerchange"/);
  assert.match(bootstrap, /const hadController = Boolean\(navigator\.serviceWorker\.controller\)/);
});
