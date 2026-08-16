import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/next-entry.js";

test("HTTP canonicalizes to HTTPS on the apex domain", async () => {
  const response = await worker.fetch(new Request("http://kutno.ru/recipes?q=test"), {}, {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://kutno.ru/recipes?q=test");
});

test("www canonicalizes to HTTPS on the apex domain", async () => {
  const response = await worker.fetch(new Request("http://www.kutno.ru/recipe/test"), {}, {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://kutno.ru/recipe/test");
});
