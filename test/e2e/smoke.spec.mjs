import { expect, test } from "@playwright/test";

function recipe(index, overrides = {}) {
  const titles = [
    "Яичница тестовая",
    "Салат из помидоров",
    "Сэндвич с сыром",
    "Рис с овощами",
    "Картофельный салат",
    "Капрезе",
    "Салат с тунцом",
    "Рулет из лаваша",
  ];
  return {
    id: `qa-${index + 1}`,
    title: titles[index] || `Тестовый рецепт ${index + 1}`,
    subtitle: "Проверенный тестовый рецепт",
    cuisine: index % 2 ? "Домашняя кухня" : "Италия",
    flag: index % 2 ? "🥗" : "🇮🇹",
    course: index % 3 === 0 ? "завтрак" : index % 3 === 1 ? "салат" : "перекус",
    protein: index === 6 ? "рыба и морепродукты" : "без мяса",
    minutes: 8 + index * 2,
    difficulty: "легко",
    portions: 2,
    equipment: index === 0 ? ["Сковорода"] : ["Нож", "Миска"],
    ingredients: index === 0
      ? [
          { name: "яйца", amount: "3 шт." },
          { name: "масло", amount: "1 ч. л." },
          { name: "соль", amount: "по вкусу" },
        ]
      : [
          { name: "помидоры", amount: "2 шт." },
          { name: "огурец", amount: "1 шт." },
          { name: "растительное масло", amount: "1 ст. л." },
          { name: "соль", amount: "по вкусу" },
        ],
    steps: ["Подготовьте продукты.", "Соедините ингредиенты.", "Сразу подавайте."],
    tip: "Готовьте спокойно и проверяйте вкус.",
    nutrition: { calories: 180 + index * 20, protein: 8, fat: 9, carbs: 14, estimated: true },
    source: {
      id: `qa-source-${index + 1}`,
      name: "Кутно QA",
      type: "kutno-catalog",
      url: index === 0 ? "" : "https://kutno.ru/",
    },
    ...overrides,
  };
}

const catalog = Array.from({ length: 8 }, (_, index) => recipe(index));

async function installApi(page, { failCatalog = false } = {}) {
  let catalogRequests = 0;

  await page.route("https://accounts.google.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};",
    });
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/auth/me") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
      return;
    }
    if (path === "/api/config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa-client", yandexEnabled: false }) });
      return;
    }
    if (path === "/api/catalog") {
      catalogRequests += 1;
      if (failCatalog) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary" }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes: catalog, total: catalog.length }) });
      }
      return;
    }
    if (path === "/api/generate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recipes: catalog.slice(0, 3), hasMore: true, source: "qa" }),
      });
      return;
    }
    if (path === "/api/feature-state" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: {} }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  return { catalogRequests: () => catalogRequests };
}

test("основной путь: кухня → рецепт → база → избранное → АМ → вход", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const api = await installApi(page);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Кухня", exact: true })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "Предложить блюда" })).toBeDisabled();

  await page.getByRole("button", { name: "+ яйца", exact: true }).click();
  await expect(page.locator('[data-remove-ingredient="яйца"]')).toBeVisible();
  await page.getByRole("button", { name: "Предложить блюда" }).click();
  await expect(page.getByRole("button", { name: "Яичница тестовая", exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Яичница тестовая", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#recipe-title")).toHaveText("Яичница тестовая");
  await expect(page.getByRole("button", { name: "Готовить", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Закрыть/ }).last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "База", exact: true }).click();
  await expect(page.getByRole("heading", { name: "База рецептов" })).toBeVisible();
  await expect(page.locator(".catalog-card")).toHaveCount(5);
  await expect(page.locator(".pot-loader-large")).toHaveCount(0);
  expect(api.catalogRequests()).toBe(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.locator("[data-catalog-scroll-sentinel]").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".catalog-card").count()).toBe(6);
  await page.waitForTimeout(650);
  await expect(page.locator(".catalog-card-entering")).toHaveCount(0);

  await page.getByRole("button", { name: "Сохранить в избранное" }).first().click();
  await expect(page.locator('.header-nav [data-view="favorites"]')).toContainText("1");
  await page.locator('.header-nav [data-view="favorites"]').click();
  await expect(page.getByText(catalog[0].title, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "АМ ❤️", exact: true }).click();
  await expect(page.locator(".swipe-card.front")).toBeVisible();
  await page.getByRole("button", { name: "Пропустить рецепт" }).click();
  await page.waitForTimeout(500);
  await expect(page.locator(".swipe-card.front")).toBeVisible();

  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Войти в Кутно" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Войти в Кутно" })).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test("аварийная база не входит в бесконечный цикл загрузки", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const api = await installApi(page, { failCatalog: true });

  await page.goto("/");
  await page.getByRole("button", { name: "База", exact: true }).click();
  await expect(page.locator(".catalog-card").first()).toBeVisible({ timeout: 12_000 });
  await expect(page.locator(".pot-loader-large")).toHaveCount(0);

  await page.waitForTimeout(9_500);
  expect(api.catalogRequests()).toBeGreaterThanOrEqual(3);
  expect(api.catalogRequests()).toBeLessThanOrEqual(5);
  await expect(page.locator(".catalog-card").first()).toBeVisible();
  await expect(page.locator(".pot-loader-large")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
