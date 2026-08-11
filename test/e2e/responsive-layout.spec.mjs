import { expect, test } from "@playwright/test";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const photoViewports = [[390, 844], [700, 900], [701, 900], [1024, 768], [1440, 900]];

function responsiveRecipe() {
  return {
    id: "simple:qa-responsive-omlet",
    compact: true,
    title: "Омлет",
    subtitle: "Нежный омлет из яиц на сковороде",
    cuisine: "Домашняя кухня",
    flag: "",
    course: "завтрак",
    protein: "без мяса",
    minutes: 10,
    difficulty: "легко",
    portions: 2,
    equipment: ["Сковорода"],
    ingredients: [
      { name: "яйца", aliases: ["яйцо"], pantry: false },
      { name: "соль", aliases: [], pantry: true },
    ],
    nutrition: { calories: 245 },
    source: { id: "simple:qa-responsive-omlet", name: "Кутно QA", type: "kutno-simple-catalog", url: "" },
    matching: { group: "ready", missingRequired: [], missingOptional: [], score: 100 },
    missing: [],
    uses: ["яйца"],
    why: "Все обязательные продукты есть дома",
  };
}

async function installApi(page) {
  const recipe = responsiveRecipe();

  await page.route("https://accounts.google.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.google={accounts:{id:{initialize(){},renderButton(){}}}};",
  }));

  await page.route("**/img/omlet-1x1.webp", (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: pixel,
  }));

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/auth/me" || path === "/api/feature-state") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "not authenticated" }) });
      return;
    }
    if (path === "/api/config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleClientId: "qa", yandexEnabled: false }) });
      return;
    }
    if (path === "/api/telemetry") {
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (path === "/api/photo-manifest") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos: [{ id: recipe.id, title: recipe.title, slug: "omlet" }] }),
      });
      return;
    }
    if (path === "/api/matching-suggestions") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
      return;
    }
    if (path === "/api/generate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recipes: [recipe], suggestions: [], source: "deterministic-catalog", hasMore: false }),
      });
      return;
    }
    if (path === "/api/catalog" || path === "/api/catalog-index") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(path === "/api/catalog"
          ? { recipes: [], total: 0, nextCursor: "", facets: { cuisines: [], difficulties: [], courses: [], proteins: [] } }
          : { index: [], total: 0, facets: { cuisines: [], difficulties: [], courses: [], proteins: [] } }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function resetAt(page, width, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".kitchen-form")).toBeVisible();
}

async function generatePhotoResult(page) {
  const eggs = page.getByRole("button", { name: "+ яйца", exact: true });
  await eggs.click();
  await page.getByRole("button", { name: "Предложить блюда", exact: true }).click();
  await expect(page.locator(".recipe-entry")).toHaveCount(1);
  await expect(page.locator(".recipe-entry > .kutno-recipe-marker")).toBeVisible();
  await expect(page.locator(".recipe-entry .kutno-recipe-photo-link")).toBeVisible();
}

async function readRecipeLayout(page) {
  return page.locator(".recipe-entry").evaluate((entry) => {
    const main = entry.querySelector(":scope > .recipe-main");
    const side = entry.querySelector(":scope > .recipe-side");
    const marker = entry.querySelector(":scope > .kutno-recipe-marker");
    const title = main?.querySelector("h3");
    const rect = (element) => {
      const value = element?.getBoundingClientRect();
      return value ? { left: value.left, right: value.right, width: value.width, height: value.height } : null;
    };
    const style = (element) => {
      if (!element) return null;
      const value = getComputedStyle(element);
      return {
        display: value.display,
        gridColumn: value.gridColumn,
        gridRow: value.gridRow,
        minWidth: value.minWidth,
      };
    };
    return {
      viewport: innerWidth,
      clientWidth: document.documentElement.clientWidth,
      mobileMedia: matchMedia("(max-width: 700px)").matches,
      entryGrid: getComputedStyle(entry).gridTemplateColumns,
      children: [...entry.children].map((element) => element.className),
      marker: rect(marker),
      main: rect(main),
      side: rect(side),
      title: rect(title),
      markerStyle: style(marker),
      mainStyle: style(main),
      sideStyle: style(side),
    };
  });
}

for (const [width, height] of photoViewports) {
  test(`карточка результата с фото стабильна при холодной загрузке ${width}x${height}`, async ({ page }) => {
    await installApi(page);
    await resetAt(page, width, height);
    await generatePhotoResult(page);

    const layout = await readRecipeLayout(page);
    const debug = JSON.stringify(layout);

    expect(layout.children, debug).toHaveLength(3);
    expect(layout.children[0], debug).toContain("kutno-recipe-marker");
    expect(layout.children[1], debug).toContain("recipe-main");
    expect(layout.children[2], debug).toContain("recipe-side");
    expect(layout.main.width, debug).toBeGreaterThan(160);
    expect(layout.title.width, debug).toBeGreaterThan(120);
    expect(layout.title.height, debug).toBeLessThan(180);
    expect(layout.marker.left, debug).toBeGreaterThanOrEqual(-1);
    expect(layout.side.right, debug).toBeLessThanOrEqual(layout.viewport + 1);
  });
}

test("кухня и выдача не обрезаются между tablet и desktop", async ({ page }) => {
  await installApi(page);

  for (const width of [981, 1000, 1024, 1050, 1100]) {
    await resetAt(page, width, 800);

    const kitchen = await page.locator(".kitchen-form").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { viewport: innerWidth, left: rect.left, right: rect.right, width: rect.width };
    });
    expect(kitchen.left, `kitchen left at ${width}px`).toBeGreaterThanOrEqual(-1);
    expect(kitchen.right, `kitchen right at ${width}px`).toBeLessThanOrEqual(kitchen.viewport + 1);

    await generatePhotoResult(page);
    const results = await page.locator(".results-section").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { viewport: innerWidth, left: rect.left, right: rect.right, width: rect.width };
    });
    expect(results.left, `results left at ${width}px`).toBeGreaterThanOrEqual(-1);
    expect(results.right, `results right at ${width}px`).toBeLessThanOrEqual(results.viewport + 1);
  }
});
