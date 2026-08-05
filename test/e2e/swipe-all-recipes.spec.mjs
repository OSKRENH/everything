import { expect, test } from "@playwright/test";

function recipe(index) {
  return {
    id: `swipe-all-${index + 1}`,
    title: `Рецепт АМ ${index + 1}`,
    subtitle: "Не зависит от продуктов кухни",
    cuisine: index % 2 ? "Италия" : "Россия",
    flag: index % 2 ? "🇮🇹" : "🇷🇺",
    course: "основное",
    protein: "без мяса",
    minutes: 20,
    difficulty: "легко",
    portions: 2,
    equipment: ["Кастрюля"],
    ingredients: [{ name: "помидоры", amount: "2 шт." }],
    steps: ["Подготовьте продукты.", "Приготовьте блюдо.", "Подавайте."],
    nutrition: { calories: 180, protein: 4, fat: 6, carbs: 24, estimated: true },
    source: { id: `swipe-all-${index + 1}`, name: "Кутно QA", type: "kutno-catalog", url: "" },
  };
}

const catalog = Array.from({ length: 13 }, (_, index) => recipe(index));

async function installApi(page) {
  const catalogUrls = [];
  await page.addInitScript(() => {
    localStorage.setItem("kutno-kitchen-v2", JSON.stringify({
      ingredients: ["яйца"],
      priorityIngredients: [],
      equipment: ["pan"],
      difficulty: "легко",
      portions: 2,
      searchMode: "strict",
      maxMinutes: 15,
      course: "завтрак",
    }));
    localStorage.removeItem("kutno-swipe-history-v1");
    localStorage.removeItem("kutno-favorites-v1");
    localStorage.removeItem("kutno-cooking-history-v1");
  });
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};",
  }));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
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
    if (url.pathname === "/api/catalog") {
      catalogUrls.push(url);
      const cursor = url.searchParams.get("cursor") || "";
      const offset = cursor === "page-5" ? 5 : cursor === "page-10" ? 10 : 0;
      const recipes = catalog.slice(offset, offset + 5);
      const nextCursor = offset === 0 ? "page-5" : offset === 5 ? "page-10" : "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recipes, total: catalog.length, nextCursor, limit: 5 }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return { catalogUrls };
}

async function expectFullSwipeDeck(page, api) {
  await expect(page.locator(".swipe-card-counter")).toContainText("/ 13", { timeout: 15_000 });
  await expect.poll(() => api.catalogUrls.length, { timeout: 10_000 }).toBe(3);
  const loaded = await page.evaluate(() => window.kutnoBridge?.getCatalogRecipes?.().length || 0);
  expect(loaded).toBe(catalog.length);
  for (const url of api.catalogUrls) {
    expect(url.searchParams.has("ingredients")).toBe(false);
    expect(url.searchParams.has("equipment")).toBe(false);
    expect(url.searchParams.has("course")).toBe(false);
    expect(url.searchParams.has("maxMinutes")).toBe(false);
  }
}

test("АМ загружает все страницы и не фильтруется продуктами кухни", async ({ page }) => {
  const api = await installApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "АМ ❤️", exact: true }).click();
  await expectFullSwipeDeck(page, api);
});

test("прямое открытие АМ тоже собирает полный каталог", async ({ page }) => {
  const api = await installApi(page);
  await page.goto("/#swipe");
  await expectFullSwipeDeck(page, api);
});
