import { expect, test } from "@playwright/test";

const compactRecipe = {
  id: "public-1",
  compact: true,
  title: "Публичный рецепт",
  subtitle: "Проверка красивого URL",
  cuisine: "Домашняя кухня",
  flag: "🍳",
  course: "основное",
  protein: "без мяса",
  minutes: 15,
  difficulty: "легко",
  portions: 2,
  equipment: ["Сковорода"],
  ingredients: [{ name: "яйца", aliases: [], pantry: false }],
  nutrition: { calories: 220 },
  source: { id: "public-1", name: "Кутно QA", type: "kutno-catalog", url: "" },
  missing: [],
  uses: [],
};

const fullRecipe = {
  ...compactRecipe,
  compact: false,
  ingredients: [{ name: "яйца", amount: "4 шт." }, { name: "соль", amount: "по вкусу" }],
  steps: ["Разбейте яйца.", "Приготовьте на сковороде.", "Подавайте сразу."],
  nutrition: { calories: 220, protein: 18, fat: 15, carbs: 2 },
  tip: "Не пересушивайте яйца.",
};

async function installApi(page) {
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};" }));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
    if (url.pathname === "/api/config") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa", yandexEnabled: false }) });
    if (url.pathname === "/api/telemetry") return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    if (url.pathname === "/api/catalog-index") return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        index: [{ id: compactRecipe.id, title: compactRecipe.title, cuisine: compactRecipe.cuisine, flag: compactRecipe.flag, course: compactRecipe.course, protein: compactRecipe.protein, minutes: compactRecipe.minutes, difficulty: compactRecipe.difficulty, ingredients: ["яйца"], searchable: "публичный рецепт яйца" }],
        total: 1,
        facets: { cuisines: [{ value: "Домашняя кухня", flag: "🍳" }], difficulties: ["легко"], courses: ["основное"], proteins: ["без мяса"] },
      }),
    });
    if (url.pathname === "/api/catalog") return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ recipes: [compactRecipe], total: 1, nextCursor: "", limit: 12, facets: { cuisines: [{ value: "Домашняя кухня", flag: "🍳" }], difficulties: ["легко"], courses: ["основное"], proteins: ["без мяса"] } }),
    });
    if (url.pathname === "/api/recipe/public-1") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipe: fullRecipe }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function installPublicRoute(page, route) {
  await page.addInitScript((payload) => {
    window.__KUTNO_PUBLIC_ROUTE__ = payload;
    history.replaceState({}, "", payload.pathname);
  }, route);
}

test("/recipes открывает штатную Базу Кутно", async ({ page }) => {
  await installApi(page);
  await installPublicRoute(page, { type: "catalog", pathname: "/recipes" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "База", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await expect(page.locator(".catalog-card h3")).toContainText("Публичный рецепт");
  expect(new URL(page.url()).pathname).toBe("/recipes");
});

test("/recipe/slug открывает штатный большой recipe-sheet", async ({ page }) => {
  await installApi(page);
  await installPublicRoute(page, { type: "recipe", id: "public-1", title: "Публичный рецепт", slug: "publichnyi-retsept", pathname: "/recipe/publichnyi-retsept" });
  await page.goto("/");
  await expect(page.locator(".recipe-sheet")).toBeVisible();
  await expect(page.locator("#recipe-title")).toHaveText("Публичный рецепт");
  await expect(page.locator(".recipe-sheet")).toContainText("Ингредиенты");
  await expect(page.locator(".recipe-sheet")).toContainText("Как готовить");
  await expect(page.getByRole("button", { name: /В избранное/ })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/recipe/publichnyi-retsept");
});
