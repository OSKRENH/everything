import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/shopping-pantry-bridge.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("shopping pantry bridge is loaded by the current Kutno shell", () => {
  assert.match(index, /src\/shopping-pantry-bridge\.js\?v=1/);
});

test("shopping pantry bridge snapshots bought rows before shopping removes them", () => {
  assert.ok(source.includes('data-kf-action="move-bought"'));
  assert.match(source, /addEventListener\("click", handleMoveBought, true\)/);
  assert.match(source, /queueMicrotask\(\(\) => applyBoughtAmounts\(bought\)\)/);
});

test("shopping pantry bridge carries supported quantities into pantry", () => {
  assert.match(source, /kutno-shopping-v2/);
  assert.match(source, /kutnoStore\.updatePantry/);
  assert.match(source, /кг\|г\|мл\|л\|шт/);
  assert.match(source, /toBase/);
});
