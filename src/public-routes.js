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

function catalogEntryMatchesCurrent(entry, current) {
  if (!entry || !current?.recipe) return false;
  const currentId = String(current.id || "");
  const entryId = String(entry.id || "");
  if (currentId && entryId && currentId === entryId) return true;
  const currentTitle = slug(current.recipe.title || "");
  const entryTitle = slug(entry.title || "");
  return Boolean(currentTitle && entryTitle && currentTitle === entryTitle);
}

function localCatalogEntry(current) {
  const recipes = window.kutnoBridge?.getCatalogRecipes?.() || [];
  return recipes.find((recipe) => catalogEntryMatchesCurrent({
    id: window.kutnoBridge?.getRecipeId?.(recipe) || recipe?.id || recipe?.source?.id || "",
    title: recipe?.title || "",
  }, current)) || null;
}

async function catalogIndex() {
  if (!catalogIndex.promise) {
    catalogIndex.promise = fetch("/api/catalog-index", { headers: { accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`catalog index ${response.status}`);
        return response.json();
      })
      .then((data) => Array.isArray(data?.index) ? data.index : [])
      .catch(() => {
        catalogIndex.promise = null;
        return [];
      });
  }
  return catalogIndex.promise;
}

async function publicCatalogEntry(current) {
  const local = localCatalogEntry(current);
  if (local) return local;
  const index = await catalogIndex();
  return index.find((entry) => catalogEntryMatchesCurrent(entry, current)) || null;
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
    try {
      const current = window.kutnoBridge?.getCurrentRecipe?.();
      if (!current?.recipe || !document.querySelector(".recipe-sheet")) return;
      const entry = await publicCatalogEntry(current);
      if (!entry) return;
      const pathname = recipePath({ title: entry.title || current.recipe.title });
      if (!pathname || location.pathname === pathname) return;
      const returnTo = location.pathname.startsWith("/recipe/") ? "/recipes" : currentLocation();
      history.pushState({
        kutnoRecipeOverlay: true,
        kutnoRecipeId: entry.id || current.id,
        kutnoRecipeTitle: entry.title || current.recipe.title || "",
        returnTo,
      }, "", pathname);
    } finally {
      overlaySyncQueued = false;
    }
  });
}

const app = document.querySelector("#app");
if (app) {
  new MutationObserver(() => {
    if (document.querySelector(".recipe-sheet")) syncRecipeUrlFromOverlay();
  }).observe(app, { childList: true, subtree: true });
}

window.addEventListener("kutno:bridge-ready", () => {
  if (document.querySelector(".recipe-sheet")) syncRecipeUrlFromOverlay();
});

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

window.kutnoPublicRoute = { slug, recipePath, apply: applyPublicRoute, sync: syncRecipeUrlFromOverlay };
