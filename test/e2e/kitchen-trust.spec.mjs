import { expect, test } from "@playwright/test";

function serverRecipe(overrides = {}) {
  return {
    id: "server-omelet",
    title: "Серверный омлет",
    subtitle: "Должен быть выше локальных резервных вариантов",
    cuisine: "Франция",
    flag: "🇫🇷",
    course: "завтрак",
    protein: "без мяса",
    minutes: 12,
    difficulty: "легко",
    portions: 2,
    equipment: ["Сковорода"],
    ingredients: [
      { name: "яйца", amount: "4 шт." },
      { name: "молоко", amount: "100 мл" },
      { name: "растительное масло", amount: "1 ч. л.", pantry: true },
      { name: "соль", amount: "по вкусу", pantry: true },
    ],
    steps: ["Взбейте яйца с молоком.", "Вылейте смесь на сковороду.", "Готовьте до схватывания."],
    nutrition: { calories: 280, protein: 22, fat: 19, carbs: 4, estimated: true },
    source: { id: "server-omelet", name: "Кутно QA", type: "kutno-catalog", url: "" },
    ...overrides,
  };
}

async function installCommonApi(page, generateHandler) {
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};",
  }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/me") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
      return;
    }
    if (url.pathname === "/api/config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa", yandexEnabled: false }) });
      return;
    }
    if (url.pathname === "/api/telemetry") {
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (url.pathname === "/api/generate") {
      await generateHandler(route, JSON.parse(request.postData() || "{}"));
      return;
    }
    if (url.pathname === "/api/catalog") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes: [], total: 0, nextCursor: "" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function addKitchenProducts(page) {
  await page.getByRole("button", { name: "+ яйца", exact: true }).click();
  await page.locator("#ingredient-input").fill("молоко");
  await page.getByRole("button", { name: "Добавить продукты" }).click();
  await expect(page.locator('[data-remove-ingredient="молоко"]')).toBeVisible();
}

async function addKitchenProductThroughInput(page, product) {
  await page.locator("#ingredient-input").fill(product);
  await page.getByRole("button", { name: "Добавить продукты" }).click();
  await expect(page.locator(`[data-remove-ingredient="${product}"]`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Предложить блюда" })).toBeEnabled();
}

async function setKitchenQuantities(page) {
  await page.evaluate(() => {
    localStorage.setItem("kutno-pantry-details-v1", JSON.stringify({
      яйца: { name: "яйца", quantity: 1, unit: "шт.", updatedAt: Date.now() },
      молоко: { name: "молоко", quantity: 250, unit: "мл", updatedAt: Date.now() },
    }));
  });
}

test("основной подбор ставит серверный рецепт выше резерва и учитывает количество", async ({ page }) => {
  const requests = [];
  await page.addInitScript(() => {
    localStorage.setItem("kutno-recipe-feedback-v1", JSON.stringify([{
      recipeId: "old-milk-recipe",
      title: "Старое молочное блюдо",
      reason: "dislike-ingredient",
      ingredient: "молоко",
      at: Date.now(),
      updatedAt: Date.now(),
    }]));
  });
  await installCommonApi(page, async (route, body) => {
    requests.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ recipes: [serverRecipe()], hasMore: false, source: "semantic-catalog", relaxation: null }),
    });
  });

  await page.goto("/");
  await addKitchenProducts(page);
  await setKitchenQuantities(page);
  await page.getByRole("button", { name: "Предложить блюда" }).click();

  await expect(page.getByRole("button", { name: "Серверный омлет", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Докупить: яйца", { exact: true })).toBeVisible();
  await expect(page.getByText("Яичница", { exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].pantry.яйца.quantity).toBe(1);
  expect(requests[0].feedback[0].reason).toBe("dislike-ingredient");
  expect(requests[0].searchMode).toBe("strict");
});

test("близкие варианты показываются сразу тремя группами без отдельного расширения", async ({ page }) => {
  const requests = [];
  await installCommonApi(page, async (route, body) => {
    requests.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        recipes: [
          serverRecipe({
            id: "ready-eggs",
            title: "Яйца прямо сейчас",
            ingredients: [
              { name: "яйца", amount: "1 шт." },
              { name: "соль", amount: "по вкусу", pantry: true },
            ],
          }),
          serverRecipe({
            id: "one-purchase-omelet",
            title: "Омлет с одной покупкой",
            ingredients: [
              { name: "яйца", amount: "1 шт." },
              { name: "молоко", amount: "100 мл" },
              { name: "соль", amount: "по вкусу", pantry: true },
            ],
          }),
          serverRecipe({
            id: "almost-omelet",
            title: "Омлет почти подходит",
            ingredients: [
              { name: "яйца", amount: "1 шт." },
              { name: "молоко", amount: "100 мл" },
              { name: "сыр", amount: "50 г" },
              { name: "соль", amount: "по вкусу", pantry: true },
            ],
          }),
        ],
        hasMore: false,
        source: "semantic-catalog",
        relaxation: null,
      }),
    });
  });

  await page.goto("/");
  await addKitchenProductThroughInput(page, "яйца");
  await page.getByRole("button", { name: "Предложить блюда" }).click();

  await expect(page.getByRole("heading", { name: "Готовьте сейчас" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Купить один продукт" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Почти подходит" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Яйца прямо сейчас", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Омлет с одной покупкой", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Омлет почти подходит", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Показать с одной покупкой/ })).toHaveCount(0);

  expect(requests).toHaveLength(1);
  expect(requests[0].searchMode).toBe("strict");
});