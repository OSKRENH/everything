import { expect, test } from "@playwright/test";

const eggRecipe = {
  id: "qa-egg-tools",
  title: "Яичница для проверки",
  subtitle: "Яйца с растительным маслом",
  cuisine: "Домашняя кухня",
  flag: "🍳",
  course: "завтрак",
  protein: "без мяса",
  minutes: 8,
  difficulty: "легко",
  portions: 2,
  equipment: ["Сковорода"],
  ingredients: [
    { name: "яйца", amount: "3 шт." },
    { name: "масло", amount: "1 ч. л." },
    { name: "соль", amount: "по вкусу" },
  ],
  steps: [
    "Разбейте яйца в миску и перемешайте.",
    "Налейте масло в сковороду и готовьте яйца 3 минуты.",
    "Посолите и подавайте.",
  ],
  nutrition: { calories: 260, protein: 19, fat: 20, carbs: 1, estimated: true },
  source: { id: "qa-egg-tools", name: "Кутно QA", type: "kutno-catalog", url: "" },
};

async function installApi(page) {
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};",
  }));

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/auth/me") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
      return;
    }
    if (pathname === "/api/config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa-client", yandexEnabled: false }) });
      return;
    }
    if (pathname === "/api/catalog") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes: [eggRecipe], total: 1 }) });
      return;
    }
    if (pathname === "/api/generate") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes: [eggRecipe], hasMore: false }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function openEggRecipe(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "+ яйца", exact: true }).click();
  await page.getByRole("button", { name: "Предложить блюда" }).click();
  await page.getByRole("button", { name: eggRecipe.title, exact: true }).first().click();
  await expect(page.locator("#recipe-title")).toHaveText(eggRecipe.title);
  await expect(page.locator("[data-kf-action='add-missing']")).toBeVisible();
}

test("стандартное растительное масло учитывается и в списке покупок", async ({ page }) => {
  await installApi(page);
  await openEggRecipe(page);
  await expect(page.locator("[data-kf-action='add-missing']")).toHaveText("Все продукты дома");
  await expect(page.locator("[data-kf-action='add-missing']")).toBeDisabled();
});

test("настройки базы управляют покупками, порциями и режимом готовки", async ({ page }) => {
  await installApi(page);
  await page.addInitScript(() => {
    localStorage.setItem("kutno-base-ingredients-v1", JSON.stringify(["соль", "вода", "сахар"]));
  });
  await openEggRecipe(page);

  const portions = page.locator("[data-kf-portions-output]");
  await expect(portions).toHaveText("2 порции");
  await page.locator("[data-kf-action='portion-up']").click();
  await expect(portions).toHaveText("3 порции");

  const addMissing = page.locator("[data-kf-action='add-missing']");
  await expect(addMissing).toHaveText("В покупки · 1");
  await addMissing.click();
  await page.getByRole("button", { name: "Открыть покупки", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Список покупок" })).toBeVisible();
  await expect(page.locator(".kf-shopping-item strong")).toHaveText("масло");
  await page.locator(".kf-shopping-panel [data-kf-action='close-shopping']").click();

  await page.getByRole("button", { name: "Готовить", exact: true }).click();
  await expect(page.locator("[data-action='next-cooking-step']")).toBeVisible();
  await page.locator("[data-action='next-cooking-step']").click();
  await expect(page.locator("[data-action='previous-cooking-step']")).toBeEnabled();
});
