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

test("основной подбор ставит серверный рецепт выше резерва и учитывает количество", async ({ page }) => {
  const requests = [];
  await page.addInitScript(() => {
    localStorage.setItem("kutno-pantry-details-v1", JSON.stringify({
      яйца: { name: "яйца", quantity: 1, unit: "шт.", updatedAt: Date.now() },
      молоко: { name: "молоко", quantity: 250, unit: "мл", updatedAt: Date.now() },
    }));
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
  await page.getByRole("button", { name: "Предложить блюда" }).click();

  await expect(page.getByRole("button", { name: "Серверный омлет", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Докупить: яйца", { exact: true })).toBeVisible();
  await expect(page.getByText("Яичница", { exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].pantry.яйца.quantity).toBe(1);
  expect(requests[0].feedback[0].reason).toBe("dislike-ingredient");
  expect(requests[0].searchMode).toBe("strict");
});

test("строгий режим расширяется только после отдельного нажатия", async ({ page }) => {
  const requests = [];
  await installCommonApi(page, async (route, body) => {
    requests.push(body);
    const expanded = body.searchMode === "plus-one";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(expanded
        ? { recipes: [serverRecipe({ title: "Омлет с одной покупкой" })], hasMore: false, source: "semantic-catalog", relaxation: null }
        : {
            recipes: [],
            hasMore: false,
            error: "Точных вариантов пока нет",
            relaxation: null,
            suggestedExpansion: {
              code: "allow-one-purchase",
              title: "Точных вариантов пока нет",
              details: "Можно отдельно разрешить одну покупку.",
              count: 4,
            },
          }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "+ яйца", exact: true }).click();
  await page.getByRole("button", { name: "Предложить блюда" }).click();

  const expand = page.getByRole("button", { name: "Показать с одной покупкой · 4" });
  await expect(expand).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].searchMode).toBe("strict");

  await expand.click();
  await expect(page.getByRole("button", { name: "Омлет с одной покупкой", exact: true }).first()).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].searchMode).toBe("plus-one");
});
