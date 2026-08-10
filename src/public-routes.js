const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slug(value = "") {
  return String(value)
    .toLocaleLowerCase("ru-RU")
    .split("")
    .map((character) => CYRILLIC[character] ?? character)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "recipe";
}

function recipePath(recipe) {
  const title = String(recipe?.title || "").trim();
  return title ? `/recipe/${slug(title)}` : "";
}

function currentLocation() {
  return `${location.pathname}${location.search}${location.hash}`;
}

function openCatalogView() {
  const button = document.querySelector('[data-view="catalog"]');
  if (button && !button.classList.contains("active")) button.click();
}

function closeRecipeOverlay() {
  const close = document.querySelector('.recipe-sheet [data-action="close-recipe"]');
  if (close) close.click();
}

async function catalogIds() {
  if (!catalogIds.promise) {
    catalogIds.promise = fetch("/api/catalog-index", { headers: { accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => new Set((data?.index || []).map((item) => String(item.id || "")).filter(Boolean)))
      .catch(() => new Set());
  }
  return catalogIds.promise;
}

async function fetchRecipe(id) {
  const portions = Number(window.kutnoBridge?.getKitchenState?.()?.portions) || 2;
  const response = await fetch(`/api/recipe/${encodeURIComponent(id)}?portions=${encodeURIComponent(portions)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.recipe || null;
}

async function openRecipeById(id, title = "", animate = false) {
  if (!id || !window.kutnoBridge) return false;
  const recipe = await fetchRecipe(id);
  if (!recipe) return false;
  return window.kutnoBridge.openRecipe({ id, title, recipe, animate });
}

async function applyPublicRoute(route = window.__KUTNO_PUBLIC_ROUTE__) {
  if (!route || !window.kutnoBridge) return;
  if (route.type === "catalog") {
    closeRecipeOverlay();
    openCatalogView();
    return;
  }
  if (route.type !== "recipe") return;
  openCatalogView();
  history.replaceState({
    ...(history.state || {}),
    kutnoDirectRecipe: true,
    kutnoRecipeId: route.id,
    kutnoRecipeTitle: route.title || "",
  }, "", route.pathname || location.pathname);
  await openRecipeById(route.id, route.title || "", false);
}

let overlaySyncQueued = false;
async function syncRecipeUrlFromOverlay() {
  if (overlaySyncQueued) return;
  overlaySyncQueued = true;
  queueMicrotask(async () => {
    overlaySyncQueued = false;
    const current = window.kutnoBridge?.getCurrentRecipe?.();
    if (!current?.recipe || !document.querySelector(".recipe-sheet")) return;
    const ids = await catalogIds();
    if (!ids.has(String(current.id || ""))) return;
    const pathname = recipePath(current.recipe);
    if (!pathname || location.pathname === pathname) return;
    const returnTo = location.pathname.startsWith("/recipe/") ? "/recipes" : currentLocation();
    history.pushState({
      kutnoRecipeOverlay: true,
      kutnoRecipeId: current.id,
      kutnoRecipeTitle: current.recipe.title || "",
      returnTo,
    }, "", pathname);
  });
}

const app = document.querySelector("#app");
if (app) {
  new MutationObserver(() => {
    if (document.querySelector(".recipe-sheet")) syncRecipeUrlFromOverlay();
  }).observe(app, { childList: true, subtree: true });
}

document.addEventListener("click", (event) => {
  const close = event.target.closest?.("[data-action='close-recipe']");
  if (!close || !location.pathname.startsWith("/recipe/")) return;
  if (history.state?.kutnoRecipeOverlay) {
    queueMicrotask(() => history.back());
    return;
  }
  history.replaceState({}, "", "/recipes");
  queueMicrotask(openCatalogView);
}, true);

window.addEventListener("popstate", () => {
  if (location.pathname === "/recipes") {
    closeRecipeOverlay();
    openCatalogView();
    return;
  }
  if (location.pathname.startsWith("/recipe/") && history.state?.kutnoRecipeId) {
    openCatalogView();
    openRecipeById(history.state.kutnoRecipeId, history.state.kutnoRecipeTitle || "", false).catch(() => {});
    return;
  }
  if (!location.pathname.startsWith("/recipe/")) closeRecipeOverlay();
});

applyPublicRoute().catch(() => {});

window.kutnoPublicRoute = { slug, recipePath, apply: applyPublicRoute };
