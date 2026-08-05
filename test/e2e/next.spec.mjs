import { expect, test } from "@playwright/test";

function recipe(index) {
  return {
    id: `next-${index + 1}`,
    title: index === 0 ? "Яичница из трёх яиц" : `Рецепт страницы ${index + 1}`,
    subtitle: "Проверка Кутно Next",
    cuisine: "Домашняя кухня",
    flag: "🍳",
    course: "завтрак",
    protein: "без мяса",
    minutes: 12 + index,
    difficulty: index % 2 ? "обычно" : "легко",
    portions: 2,
    equipment: ["Сковорода"],
    ingredients: index === 0
      ? [{ name: "яйца", amount: "3 шт." }, { name: "масло", amount: "1 ч. л.", pantry: true }]
      : [{ name: "яйца", amount: "1 шт." }],
    steps: ["Подготовьте продукты.", "Приготовьте блюдо.", "Подавайте."],
    nutrition: { calories: 200, protein: 12, fat: 14, carbs: 3, estimated: true },
    source: { id: `next-${index + 1}`, name: "Кутно QA", type: "kutno-catalog", url: "" },
  };
}

const catalog = Array.from({ length: 11 }, (_, index) => recipe(index));

async function installApi(page) {
  let catalogRequests = 0;
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa-client", yandexEnabled: false }) });
      return;
    }
    if (url.pathname === "/api/telemetry") {
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (url.pathname === "/api/catalog") {
      catalogRequests += 1;
      const limit = Number(url.searchParams.get("limit")) || 5;
      const offset = Number(url.searchParams.get("cursor")) || 0;
      const recipes = catalog.slice(offset, offset + limit);
      const nextOffset = offset + recipes.length;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          recipes,
          total: catalog.length,
          nextCursor: nextOffset < catalog.length ? String(nextOffset) : "",
        }),
      });
      return;
    }
    if (url.pathname === "/api/generate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recipes: [catalog[0]], hasMore: false, source: "qa" }),
      });
      return;
    }
    if (url.pathname === "/api/feature-state") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return { catalogRequests: () => catalogRequests };
}

test("запасы предупреждают о нехватке и обратная связь сохраняется", async ({ page }) => {
  await installApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "+ яйца", exact: true }).click();

  const pantryButton = page.getByRole("button", { name: "Уточнить запасы" });
  await expect(pantryButton).toBeVisible();
  await pantryButton.click();
  await expect(page.getByRole("heading", { name: "Сколько продуктов осталось" })).toBeVisible();
  const row = page.locator("[data-pantry-row]").first();
  await row.locator("[name='quantity']").fill("1");
  await row.locator("[name='unit']").selectOption("шт.");
  await page.getByRole("button", { name: "Сохранить запасы" }).click();
  await expect(page.locator(".pantry-tag-meta")).toContainText("1 шт.");

  await page.getByRole("button", { name: "Предложить блюда" }).click();
  await page.getByRole("button", { name: "Яичница из трёх яиц", exact: true }).first().click();
  await expect(page.locator("[data-pantry-assessment]")).toContainText("Может не хватить");
  await page.getByRole("button", { name: "Долго", exact: true }).click();
  await expect(page.locator(".kutno-next-toast")).toContainText("Учли");
  const feedback = await page.evaluate(() => JSON.parse(localStorage.getItem("kutno-recipe-feedback-v1") || "[]"));
  expect(feedback.some((item) => item.reason === "too-long")).toBeTruthy();
});

test("каталог получает вторую страницу только у конца списка", async ({ page }) => {
  const api = await installApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "База", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(5);
  expect(api.catalogRequests()).toBe(1);
  await page.locator("[data-catalog-scroll-sentinel]").scrollIntoViewIfNeeded();
  await expect.poll(() => api.catalogRequests()).toBe(2);
  await expect.poll(() => page.locator(".catalog-card").count()).toBeGreaterThanOrEqual(6);
});
