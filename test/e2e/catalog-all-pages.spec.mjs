import { expect, test } from "@playwright/test";

function recipe(index) {
  return {
    id: `all-${index + 1}`,
    title: `Полный каталог ${index + 1}`,
    subtitle: "Проверка всех страниц",
    cuisine: "Домашняя кухня",
    flag: "🥗",
    course: "салат",
    protein: "без мяса",
    minutes: 10,
    difficulty: "легко",
    portions: 2,
    equipment: ["Нож"],
    ingredients: [{ name: "помидоры", amount: "2 шт." }],
    steps: ["Нарежьте продукты.", "Смешайте.", "Подавайте."],
    nutrition: { calories: 100, protein: 2, fat: 4, carbs: 12, estimated: true },
    source: { id: `all-${index + 1}`, name: "Кутно QA", type: "kutno-catalog", url: "" },
  };
}

const catalog = Array.from({ length: 13 }, (_, index) => recipe(index));

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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa", yandexEnabled: false }) });
      return;
    }
    if (url.pathname === "/api/telemetry") {
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (url.pathname === "/api/catalog") {
      catalogRequests += 1;
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
  return { requests: () => catalogRequests };
}

test("прокрутка доходит до последнего рецепта без повторов", async ({ page }) => {
  const api = await installApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "База", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(5);

  for (let expected = 6; expected <= catalog.length; expected += 1) {
    await page.locator("[data-catalog-scroll-sentinel]").scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator(".catalog-card").count(), { timeout: 8_000 }).toBe(expected);
    await page.waitForTimeout(560);
  }

  expect(api.requests()).toBe(3);
  const titles = await page.locator(".catalog-card h3").allTextContents();
  expect(new Set(titles).size).toBe(catalog.length);
  await expect(page.locator("[data-catalog-scroll-sentinel]")).toHaveCount(0);
});
