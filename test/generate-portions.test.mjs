import assert from "node:assert/strict";
import test from "node:test";
import matchingWorker from "../worker/matching-entry.js";

async function generate(body) {
  const response = await matchingWorker.fetch(new Request("https://kutno.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), {}, { waitUntil() {} });
  return { response, data: await response.json() };
}

test("generate на 6 порций не показывает дробные яйца и другие штучные ингредиенты", async () => {
  const { response, data } = await generate({
    ingredients: ["творог", "яйца", "мука", "сахар", "картошка", "лук"],
    portions: 6,
  });
  assert.equal(response.status, 200);
  assert.ok(data.recipes.length > 0);

  let checked = 0;
  for (const recipe of data.recipes) {
    for (const ingredient of recipe.ingredients || []) {
      const amount = String(ingredient.amount || "").trim();
      if (!/(?:шт\.?|зубч\.?|гол\.?)$/i.test(amount)) continue;
      checked += 1;
      assert.match(amount, /^\d+\s/, `${recipe.title}: ${ingredient.name} → ${amount}`);
      assert.doesNotMatch(amount, /[,.]\d+/, `${recipe.title}: ${ingredient.name} → ${amount}`);
    }
  }
  assert.ok(checked > 0, "В проверяемой выдаче должны быть штучные ингредиенты");
});
