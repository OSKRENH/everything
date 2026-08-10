const KUTNO_PUBLIC_CYRILLIC_V7 = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function kutnoPublicSlugV7(value = "") {
  return String(value)
    .toLocaleLowerCase("ru-RU")
    .split("")
    .map((character) => KUTNO_PUBLIC_CYRILLIC_V7[character] ?? character)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "recipe";
}

function kutnoPublicRecipePathV7(recipe) {
  const title = String(recipe?.title || "").trim();
  return title ? `/recipe/${kutnoPublicSlugV7(title)}` : "";
}

function kutnoPublicCurrentLocationV7() {
  return `${location.pathname}${location.search}${location.hash}`;
}

function kutnoPublicCloseOverlayV7() {
  if (!activeRecipe) return;
  setCookingMode(false);
  activeRecipe = null;
  document.body.classList.remove("no-scroll");
  renderOverlayLayer();
}

async function kutnoPublicOpenByIdV7(id, title = "", animate = false) {
  if (!id) return false;
  try {
    const data = await kutnoApi.recipeDetail(id, { portions: Number(state.portions) || 2 });
    if (!data?.recipe) return false;
    const recipe = { ...data.recipe, id: data.recipe.id || id, compact: false };
    replaceHydratedRecipeV6(recipe);
    return kutnoBridgeOpenRecipe({ id, title, recipe, animate });
  } catch (error) {
    kutnoApi.telemetry("public_recipe_open_failed", {
      id,
      message: error instanceof Error ? error.message : String(error || ""),
    }, "error");
    return false;
  }
}

async function kutnoApplyPublicRouteV7(route = window.__KUTNO_PUBLIC_ROUTE__) {
  if (!route || typeof route !== "object") return;
  if (route.type === "catalog") {
    kutnoPublicCloseOverlayV7();
    setView("catalog");
    if (!catalogRecipes.length && !catalogLoading) await loadCatalog();
    return;
  }
  if (route.type !== "recipe") return;
  setView("catalog");
  history.replaceState({ ...(history.state || {}), kutnoDirectRecipe: true, kutnoRecipeId: route.id, kutnoRecipeTitle: route.title }, "", route.pathname || location.pathname);
  await kutnoPublicOpenByIdV7(route.id, route.title, false);
}

function kutnoRouteRecipeFromTriggerV7(target) {
  const source = selectRecipeSource(target?.dataset?.recipeSource);
  const recipe = source?.[Number(target?.dataset?.openRecipe)];
  return recipe || null;
}

document.addEventListener("click", (event) => {
  const openTrigger = event.target.closest?.("[data-open-recipe]");
  if (openTrigger) {
    const recipe = kutnoRouteRecipeFromTriggerV7(openTrigger);
    const pathname = kutnoPublicRecipePathV7(recipe);
    if (pathname && location.pathname !== pathname) {
      const returnTo = location.pathname.startsWith("/recipe/") ? "/recipes" : kutnoPublicCurrentLocationV7();
      history.pushState({
        kutnoRecipeOverlay: true,
        kutnoRecipeId: catalogStableIdV6(recipe) || recipeId(recipe),
        kutnoRecipeTitle: recipe?.title || "",
        returnTo,
      }, "", pathname);
    }
    return;
  }

  const closeTrigger = event.target.closest?.("[data-action='close-recipe']");
  if (!closeTrigger || !location.pathname.startsWith("/recipe/")) return;
  if (history.state?.kutnoRecipeOverlay) {
    queueMicrotask(() => history.back());
    return;
  }
  history.replaceState({}, "", "/recipes");
  queueMicrotask(() => setView("catalog"));
}, true);

window.addEventListener("popstate", () => {
  if (location.pathname === "/recipes") {
    kutnoPublicCloseOverlayV7();
    setView("catalog");
    return;
  }
  if (location.pathname.startsWith("/recipe/") && history.state?.kutnoRecipeId) {
    setView("catalog");
    kutnoPublicOpenByIdV7(history.state.kutnoRecipeId, history.state.kutnoRecipeTitle || "", false);
    return;
  }
  if (activeRecipe && !location.pathname.startsWith("/recipe/")) kutnoPublicCloseOverlayV7();
});

window.addEventListener("kutno:ready", () => {
  kutnoApplyPublicRouteV7().catch(() => {});
}, { once: true });

window.kutnoPublicRoute = {
  slug: kutnoPublicSlugV7,
  recipePath: kutnoPublicRecipePathV7,
  apply: kutnoApplyPublicRouteV7,
};
