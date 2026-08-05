import { expect, test } from "@playwright/test";

test("при недоступном JavaScript остаётся первый экран и появляется /lite", async ({ page }) => {
  await page.route(/\.js(?:\?|$)/, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Что приготовить сегодня" })).toBeVisible();
  await expect(page.getByText("Запускаем Кутно…")).toBeVisible();
  await expect(page.getByRole("link", { name: "Открыть лёгкую версию" })).toBeVisible({ timeout: 4_500 });
  await expect(page.getByText("Соединение медленное")).toBeVisible();
});

test("лёгкая версия работает без клиентского JavaScript", async ({ page }) => {
  await page.route(/\.js(?:\?|$)/, (route) => route.abort());
  await page.goto("/lite", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Рецепты без тяжёлой загрузки" })).toBeVisible();
  await page.getByLabel("Продукты").fill("яйца, рис");
  await page.getByRole("button", { name: "Найти рецепты" }).click();
  await expect(page.locator(".card").first()).toBeVisible();

  await page.locator(".card h2 a").first().click();
  await expect(page.getByRole("heading", { name: "Ингредиенты" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Как готовить" })).toBeVisible();
});
