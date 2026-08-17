import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/shopping-pantry-bridge.js", import.meta.url), "utf8");

test("shopping pantry bridge watches the move-bought action before shopping rows are removed", () => {
  assert.match(source, /data-kf-action=\\?"move-bought/);
  assert.match(source, /addEventListener\("click", handleMoveBought, true\)/);
});

test("shopping pantry bridge carries supported quantities into pantry", () => {
  assert.match(source, /кутно-shopping-v2|kutno-shopping-v2/);
  assert.match(source, /kutnoStore\.updatePantry/);
  assert.match(source, /кг\|г\|мл\|л\|шт/);
});
