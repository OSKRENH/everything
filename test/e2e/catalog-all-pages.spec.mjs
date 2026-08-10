import { expect, test } from "@playwright/test";

const cuisineSequence = [
  ["Испания", "🇪🇸"], ["Италия", "🇮🇹"], ["Испания", "🇪🇸"], ["Италия", "🇮🇹"], ["Испания", "🇪🇸"],
  ["Россия", "🇷🇺"], ["Япония", "🇯🇵"], ["Индия", "🇮🇳"], ["Мексика", "🇲🇽"], ["Франция", "🇫🇷"],
  ["Китай", "🇨🇳"], ["Таиланд", "🇹🇭"], ["Перу", "🇵🇪"], ["Италия", "🇮🇹"], ["Россия", "🇷🇺"],
  ["Япония", "🇯🇵"], ["Франция", "🇫🇷"],
];

function recipe(index) {
  const [cuisine, flag] = cuisineSequence[index];
  return {
    id: `all-${index + 1}`,
    compact: true,
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
    ingredients: [{ name: "помидоры", aliases: [], pantry: false }],
    nutrition: { calories: 100 },
    source: { id: `all-${index + 1}`, name: "Кутно QA", type: "kutno-catalog", url: "" },
    missing: [],
    uses: [],
  };
}

const catalog = Array.from({ length: cuisineSequence.length }, (_, index) => recipe(index));
const catalogIndex = catalog.map((item) => ({
  id: item.id,
  title: item.title,
  cuisine: item.cuisine,
  flag: item.flag,
  course: item.course,
  protein: item.protein,
  minutes: item.minutes,
  difficulty: item.difficulty,
  ingredients: item.ingredients.map((ingredient) => ingredient.name),
  searchable: `${item.title} ${item.cuisine} помидоры`.toLocaleLowerCase("ru-RU"),
}));
const cuisineFacets = [...new Map(catalog.map((item) => [item.cuisine, { value: item.cuisine, flag: item.flag }])).values()];
const facets = { cuisines: cuisineFacets, difficulties: ["легко"], courses: ["салат"], proteins: ["без мяса"] };

async function installApi(page) {
  let catalogRequests = 0;
  let indexRequests = 0;
  const catalogVersions = [];
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
    if (url.pathname === "/api/config") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa", yandexEnabled: false }) });
    if (url.pathname === "/api/telemetry") return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    if (url.pathname === "/api/catalog-index") {
      indexRequests += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ index: catalogIndex, total: catalog.length, facets }) });
    }
    if (url.pathname === "/api/catalog") {
      catalogRequests += 1;
      catalogVersions.push(url.searchParams.get("v") || "");
      const cursor = url.searchParams.get("cursor") || "";
      const limit = Math.max(1, Number(url.searchParams.get("limit")) || 5);
      const offset = /^page-\d+$/.test(cursor) ? Number(cursor.slice(5)) : 0;
      const recipes = catalog.slice(offset, offset + limit);
      const nextOffset = offset + recipes.length;
      const nextCursor = nextOffset < catalog.length ? `page-${nextOffset}` : "";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recipes, total: catalog.length, nextCursor, limit, ...(offset === 0 ? { facets } : {}) }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return {
    requests: () => catalogRequests,
    indexRequests: () => indexRequests,
    catalogVersions: () => [...catalogVersions],
  };
}

async function openCatalog(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "База", exact: true }).click();
}

test("первые двенадцать карточек остаются на экране до явного продолжения", async ({ page }) => {
  const api = await installApi(page);
  await openCatalog(page);
  await expect(page.locator(".catalog-card")).toHaveCount(12);
  await expect(page.getByRole("button", { name: /Показать ещё/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".catalog-card")).toHaveCount(12);
  expect(api.requests()).toBe(1);
});

test("общий размер базы известен с первой страницы", async ({ page }) => {
  await installApi(page);
  await openCatalog(page);
  await expect(page.locator(".catalog-card")).toHaveCount(12);
  console.log("CATALOG_COUNT_TEXT", JSON.stringify(await page.locator(".catalog-count").textContent()));
  await expect(page.locator(".catalog-count")).toContainText(`В базе — ${catalog.length}`);
});

test("первая страница каталога использует версию кэша", async ({ page }) => {
  const api = await installApi(page);
  await openCatalog(page);
  await expect(page.locator(".catalog-card")).toHaveCount(12);
  expect(api.catalogVersions()[0]).toBeTruthy();
});

test("на десктопе Показать ещё добавляет полный ряд из трёх карточек", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installApi(page);
  await openCatalog(page);
  await expect(page.locator(".catalog-card")).toHaveCount(12);
  await expect(page.getByRole("button", { name: /Показать ещё/ })).toContainText("3 из 5");

  await page.getByRole("button", { name: /Показать ещё/ }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(15);
  await expect(page.getByRole("button", { name: /Показать ещё/ })).toContainText("2 из 2");
});

test("все страны видны из лёгких facets без загрузки следующих карточек", async ({ page }) => {
  const api = await installApi(page);
  await openCatalog(page);
  await expect(page.getByRole("button", { name: "🇷🇺 Россия", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "🇯🇵 Япония", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "🇵🇪 Перу", exact: true })).toBeVisible();
  expect(api.requests()).toBe(1);
});

test("полный индекс загружается отдельно после первого экрана", async ({ page }) => {
  const api = await installApi(page);
  await openCatalog(page);
  await expect(page.locator(".catalog-card")).toHaveCount(12);
  await expect.poll(api.indexRequests).toBeGreaterThanOrEqual(1);
  expect(api.requests()).toBe(1);
});

test("выбор страны сам находит рецепт на следующей странице", async ({ page }) => {
  const api = await installApi(page);
  await openCatalog(page);
  await expect.poll(api.indexRequests).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "🇵🇪 Перу", exact: true }).click();
  await expect(page.locator(".catalog-count")).toContainText("Найдено — 01");
  await expect.poll(() => page.locator(".catalog-card h3").allTextContents(), { timeout: 10_000 }).toContain("Полный каталог 13");
  expect(api.requests()).toBeGreaterThanOrEqual(2);
});

test("кнопка Показать ещё доходит до последнего рецепта без повторов", async ({ page }) => {
  const api = await installApi(page);
  await openCatalog(page);
  const cards = page.locator(".catalog-card");
  await expect(cards).toHaveCount(12);

  let previousCount = 12;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const button = page.getByRole("button", { name: /Показать ещё/ });
    if (await button.count() === 0) break;
    await button.click();
    await expect.poll(() => cards.count()).toBeGreaterThan(previousCount);
    previousCount = await cards.count();
  }

  await expect(cards).toHaveCount(catalog.length);
  expect(api.requests()).toBe(2);
  const titles = await page.locator(".catalog-card h3").allTextContents();
  expect(titles).toHaveLength(catalog.length);
  expect(new Set(titles).size).toBe(catalog.length);
  await expect(page.locator("[data-catalog-scroll-sentinel]")).toHaveCount(0);
});
