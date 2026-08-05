import { expect, test } from "@playwright/test";

const cuisineSequence = [
  ["Испания", "🇪🇸"],
  ["Италия", "🇮🇹"],
  ["Испания", "🇪🇸"],
  ["Италия", "🇮🇹"],
  ["Испания", "🇪🇸"],
  ["Россия", "🇷🇺"],
  ["Япония", "🇯🇵"],
  ["Индия", "🇮🇳"],
  ["Мексика", "🇲🇽"],
  ["Франция", "🇫🇷"],
  ["Китай", "🇨🇳"],
  ["Таиланд", "🇹🇭"],
  ["Перу", "🇵🇪"],
];

function recipe(index) {
  const [cuisine, flag] = cuisineSequence[index];
  return {
    id: `all-${index + 1}`,
    title: `Полный каталог ${index + 1}`,
    subtitle: "Проверка всех страниц",
    cuisine,
    flag,
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
const catalogIndex = catalog.map((item) => ({
  id: item.id,
  title: item.title,
  subtitle: item.subtitle,
  cuisine: item.cuisine,
  flag: item.flag,
  course: item.course,
  protein: item.protein,
  minutes: item.minutes,
  difficulty: item.difficulty,
  ingredients: item.ingredients.map((ingredient) => ingredient.name),
  searchable: `${item.title} ${item.subtitle} ${item.cuisine} помидоры`.toLocaleLowerCase("ru-RU"),
}));
const cuisineFacets = [...new Map(catalog.map((item) => [item.cuisine, { value: item.cuisine, flag: item.flag }])).values()];

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
        body: JSON.stringify({
          recipes,
          total: catalog.length,
          nextCursor,
          limit: 5,
          ...(offset === 0 ? {
            index: catalogIndex,
            facets: {
              cuisines: cuisineFacets,
              difficulties: ["легко"],
              courses: ["салат"],
              proteins: ["без мяса"],
            },
          } : {}),
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return { requests: () => catalogRequests };
}

test("до догрузки показывает размер всей базы и все страны", async ({ page }) => {
  const api = await installApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "База", exact: true }).click();

  await expect(page.locator(".catalog-card")).toHaveCount(5);
  await expect(page.locator(".catalog-count")).toContainText("В базе — 13");
  await expect(page.getByRole("button", { name: "🇷🇺 Россия", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "🇯🇵 Япония", exact: true })).toBeVisible();
  expect(api.requests()).toBe(1);

  await page.getByRole("button", { name: "🇷🇺 Россия", exact: true }).click();
  await expect(page.locator(".catalog-count")).toContainText("Найдено — 01");
  await expect.poll(() => page.locator(".catalog-card h3").allTextContents(), { timeout: 10_000 })
    .toContain("Полный каталог 6");
  expect(api.requests()).toBeGreaterThanOrEqual(2);
});

test("прокрутка доходит до последнего рецепта без повторов", async ({ page }) => {
  const api = await installApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "База", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(5);

  await expect.poll(async () => {
    const sentinel = page.locator("[data-catalog-scroll-sentinel]");
    if (await sentinel.count()) await sentinel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    return page.locator(".catalog-card").count();
  }, { timeout: 20_000, intervals: [300, 600, 600, 600] }).toBe(catalog.length);

  expect(api.requests()).toBe(3);
  const titles = await page.locator(".catalog-card h3").allTextContents();
  expect(titles).toHaveLength(catalog.length);
  expect(new Set(titles).size).toBe(catalog.length);
  await expect(page.locator("[data-catalog-scroll-sentinel]")).toHaveCount(0);
});
