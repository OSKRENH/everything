import { expect, test } from "@playwright/test";

function recipe(title, minutes, difficulty) {
  return {
    id: title.toLocaleLowerCase("ru-RU").replace(/\s+/g, "-"),
    title,
    subtitle: "Проверка сортировки Кутно",
    cuisine: "Россия",
    flag: "🇷🇺",
    course: "завтрак",
    protein: "без мяса",
    minutes,
    difficulty,
    portions: 2,
    uses: ["яйца"],
    missing: [],
    equipment: ["Сковорода"],
    ingredients: [
      { name: "яйца", amount: "2 шт." },
      { name: "соль", amount: "по вкусу", pantry: true },
    ],
    steps: ["Подготовьте продукты.", "Приготовьте блюдо."],
    nutrition: { calories: 220, protein: 14, fat: 15, carbs: 3, estimated: true },
    source: { id: title, name: "Кутно QA", type: "kutno-catalog", url: "" },
  };
}

const sortedRecipes = [
  recipe("Обычный рецепт", 20, "обычно"),
  recipe("Сложный быстрый", 8, "сложно"),
  recipe("Простой медленный", 40, "легко"),
  recipe("Очень простой", 15, "очень просто"),
];

async function installApi(page, requests, responseRecipes = sortedRecipes) {
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
      requests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          recipes: responseRecipes,
          hasMore: false,
          source: "semantic-catalog",
          relaxation: null,
        }),
      });
      return;
    }
    if (url.pathname === "/api/catalog") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes: [], total: 0, nextCursor: "" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

test("кухня показывает все результаты и сортирует их после подбора", async ({ page }) => {
  const requests = [];
  await installApi(page, requests);
  await page.goto("/");

  await expect(page.getByText("Время", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Сложность", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Порции", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Что приготовить", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ яйца", exact: true }).click();
  await page.getByRole("button", { name: "Предложить блюда" }).click();

  const titles = page.locator(".recipe-title-button");
  await expect(page.locator(".recipe-entry")).toHaveCount(4);
  await expect(page.locator(".kitchen-results-sort summary")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].portions).toBe(2);
  expect(requests[0]).not.toHaveProperty("maxMinutes");
  expect(requests[0]).not.toHaveProperty("difficulty");
  expect(requests[0]).not.toHaveProperty("priorityIngredients");

  await page.locator(".kitchen-results-sort summary").click();
  await page.getByRole("button", { name: "Приготовить быстрее" }).click();
  expect(await titles.allTextContents()).toEqual([
    "Сложный быстрый",
    "Очень простой",
    "Обычный рецепт",
    "Простой медленный",
  ]);

  await page.locator(".kitchen-results-sort summary").click();
  await page.getByRole("button", { name: "Сначала простые рецепты" }).click();
  expect(await titles.allTextContents()).toEqual([
    "Очень простой",
    "Простой медленный",
    "Обычный рецепт",
    "Сложный быстрый",
  ]);
});

test("длинная выдача раскрывается кнопкой, а приоритет продуктов не появляется", async ({ page }) => {
  const requests = [];
  const manyRecipes = [
    recipe("Омлет", 10, "легко"),
    recipe("Яичница-глазунья", 7, "легко"),
    recipe("Яичница с луком", 12, "легко"),
    recipe("Яйца вкрутую", 12, "легко"),
    recipe("Жареная картошка с луком", 35, "легко"),
    recipe("Отварной картофель", 30, "легко"),
    recipe("Картофельное пюре", 35, "легко"),
    recipe("Драники", 35, "обычно"),
  ];
  await installApi(page, requests, manyRecipes);
  await page.goto("/");

  await page.getByRole("button", { name: "+ яйца", exact: true }).click();
  await page.getByRole("button", { name: "+ картофель", exact: true }).click();
  await page.getByRole("button", { name: "+ лук", exact: true }).click();

  await expect(page.locator(".priority-products")).toHaveCount(0);
  await expect(page.getByText("Использовать сначала", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Предложить блюда" }).click();

  await expect(page.locator(".recipe-entry")).toHaveCount(8);
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(5);
  const reveal = page.getByRole("button", { name: /Загрузить ещё варианты/ });
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText("Осталось 3");

  await reveal.click();
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(8);
  await expect(page.locator("[data-kitchen-reveal-more]")).toHaveCount(0);
  expect(requests[0]).not.toHaveProperty("priorityIngredients");
});
