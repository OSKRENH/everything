import { expect, test } from "@playwright/test";

function compactRecipe(index, overrides = {}) {
  const names = ["Омлет", "Яичница-глазунья", "Жареная картошка", "Отварной картофель", "Пюре", "Картофельный салат"];
  const id = `simple:qa-fast-${index}`;
  return {
    id,
    compact: true,
    title: names[index] || `Рецепт ${index + 1}`,
    subtitle: "Быстрый проверенный вариант",
    cuisine: "Домашняя кухня",
    flag: "🍳",
    course: index < 2 ? "завтрак" : "основное",
    protein: "без мяса",
    minutes: 7 + index * 5,
    difficulty: index === 5 ? "обычно" : "легко",
    portions: 2,
    equipment: ["Сковорода"],
    ingredients: [
      { name: index < 2 ? "яйца" : "картофель", aliases: [], pantry: false },
      { name: "соль", aliases: [], pantry: true },
    ],
    nutrition: { calories: 200 + index * 20 },
    source: { id, name: "Кутно QA", type: "kutno-simple-catalog", url: "" },
    matching: { group: "ready", missingRequired: [], missingOptional: [], score: 100 },
    missing: [],
    uses: [index < 2 ? "яйца" : "картофель"],
    why: "Все обязательные продукты есть дома",
    ...overrides,
  };
}

function fullRecipe(summary) {
  return {
    ...summary,
    compact: undefined,
    ingredients: [
      { name: summary.title.includes("Омлет") || summary.title.includes("Яичница") ? "яйца" : "картофель", amount: "2 шт." },
      { name: "растительное масло", amount: "1 ч. л.", pantry: true },
      { name: "соль", amount: "по вкусу", pantry: true },
    ],
    steps: ["Подготовьте продукты.", "Приготовьте блюдо до готовности.", "Сразу подавайте."],
    nutrition: { calories: summary.nutrition.calories, protein: 10, fat: 8, carbs: 12, estimated: true },
    tip: "Готовьте на умеренном огне.",
  };
}

async function installApi(page) {
  const summaries = Array.from({ length: 6 }, (_, index) => compactRecipe(index));
  let detailRequests = 0;
  let generateRequests = 0;

  await page.route("https://accounts.google.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};",
  }));

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/auth/me") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
      return;
    }
    if (path === "/api/config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa", yandexEnabled: false }) });
      return;
    }
    if (path === "/api/telemetry") {
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (path === "/api/matching-suggestions") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ suggestions: [{ name: "лук", count: 7 }, { name: "сыр", count: 4 }] }),
      });
      return;
    }
    if (path === "/api/generate") {
      generateRequests += 1;
      const payload = JSON.parse(request.postData() || "{}");
      if (payload.aiIdeas) throw new Error("обычный подбор не должен запрашивать AI идеи");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recipes: summaries, suggestions: [{ name: "лук", count: 7 }], source: "deterministic-catalog", hasMore: false }),
      });
      return;
    }
    if (path.startsWith("/api/recipe/")) {
      detailRequests += 1;
      const id = decodeURIComponent(path.slice("/api/recipe/".length));
      const summary = summaries.find((recipe) => recipe.id === id);
      await route.fulfill({
        status: summary ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(summary ? { recipe: fullRecipe(summary) } : { error: "not found" }),
      });
      return;
    }
    if (path === "/api/catalog") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes: [], total: 0, nextCursor: "", facets: { cuisines: [], difficulties: [], courses: [], proteins: [] } }) });
      return;
    }
    if (path === "/api/catalog-index") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ index: [], total: 0, facets: { cuisines: [], difficulties: [], courses: [], proteins: [] } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  return {
    detailRequests: () => detailRequests,
    generateRequests: () => generateRequests,
  };
}

test("подсказки умные, подбор один, полный рецепт грузится только при открытии", async ({ page }) => {
  const api = await installApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: "+ яйца", exact: true }).click();
  await expect(page.locator(".quick-row")).toContainText("лук");
  await expect(page.locator(".quick-row")).toContainText("7 блюд");
  expect(api.detailRequests()).toBe(0);

  await page.getByRole("button", { name: "Предложить блюда" }).click();
  await expect(page.locator(".recipe-entry")).toHaveCount(6);
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /Загрузить ещё варианты/ })).toBeVisible();
  expect(api.generateRequests()).toBe(1);
  expect(api.detailRequests()).toBe(0);

  await page.getByRole("button", { name: "Омлет", exact: true }).click();
  await expect(page.locator("#recipe-title")).toHaveText("Омлет");
  await expect(page.locator(".ingredient-ledger")).toContainText("яйца");
  await expect.poll(api.detailRequests).toBe(1);

  await page.getByRole("button", { name: /Закрыть/ }).last().click();
  await page.getByRole("button", { name: "Омлет", exact: true }).click();
  await expect(page.locator("#recipe-title")).toHaveText("Омлет");
  expect(api.detailRequests()).toBe(1);
});
