import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { serveLitePage } from "../worker/lite-page.js";

for (const file of ["src/bootstrap.js", "worker/lite-page.js", "public/sw.js", "worker/routes.js"]) {
  test(`${file} проходит синтаксическую проверку`, () => {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}

test("index содержит самостоятельный первый экран без внешних картинок и CSS", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /data-kutno-shell/);
  assert.match(html, /Открыть лёгкую версию/);
  assert.match(html, /src="\/src\/bootstrap\.js\?v=1"/);
  assert.doesNotMatch(html, /rel="preload" as="image"/);
  assert.doesNotMatch(html, /rel="stylesheet"/);
  assert.doesNotMatch(html, /illustration-preload-cache/);
  assert.ok(Buffer.byteLength(html, "utf8") < 13_000, "первый HTML должен оставаться компактным");
});

test("Service Worker включается только на защищённом production-домене", () => {
  const bootstrap = readFileSync("src/bootstrap.js", "utf8");
  assert.match(bootstrap, /location\.protocol === "https:"/);
  assert.match(bootstrap, /"localhost", "127\.0\.0\.1"/);
  assert.match(bootstrap, /shouldRegisterServiceWorker/);
  assert.match(bootstrap, /navigator\.serviceWorker\.register/);
});

test("лёгкая страница работает без JavaScript и остаётся компактной", () => {
  const response = serveLitePage(new Request("https://kutno.test/lite?products=яйца,рис"));
  assert.equal(response.status, 200);
  return response.text().then((html) => {
    assert.match(html, /Лёгкая версия/);
    assert.match(html, /Рецепты без тяжёлой загрузки/);
    assert.match(html, /<form/);
    assert.match(html, /\/lite\/recipe\?id=/);
    assert.doesNotMatch(html, /<script/);
    assert.ok(Buffer.byteLength(html, "utf8") < 16_000, "страница /lite должна проходить в одном маленьком ответе");
  });
});

test("страница отдельного рецепта формируется Worker-ом", async () => {
  const list = await serveLitePage(new Request("https://kutno.test/lite")).text();
  const id = list.match(/\/lite\/recipe\?id=([^"&]+)/)?.[1];
  assert.ok(id);
  const response = serveLitePage(new Request(`https://kutno.test/lite/recipe?id=${id}`));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Ингредиенты/);
  assert.match(html, /Как готовить/);
  assert.doesNotMatch(html, /<script/);
});

test("/lite имеет явный приоритет в единой таблице маршрутов", () => {
  const entry = readFileSync("worker/next-entry.js", "utf8");
  const routes = readFileSync("worker/routes.js", "utf8");
  assert.match(entry, /dispatchRoute/);
  assert.doesNotMatch(entry, /matchingWorker|featureWorker|baseWorker|safeWorker/);
  assert.match(routes, /custom\("lite"/);
  assert.match(routes, /exact\("\/api\/generate"/);
  assert.ok(routes.indexOf('custom("lite"') < routes.indexOf('exact("/api/generate"'));
});
