const catalogDetailCacheV6 = new Map();

function catalogStableIdV6(recipe) {
  return String(recipe?.id || recipe?.source?.id || "");
}

function replaceHydratedRecipeV6(recipe) {
  const id = catalogStableIdV6(recipe);
  if (!id) return recipe;
  for (const list of [catalogRecipes, swipeRecipes, recipes, favoriteRecipes]) {
    if (!Array.isArray(list)) continue;
    const index = list.findIndex((item) => catalogStableIdV6(item) === id);
    if (index >= 0) list[index] = recipe;
  }
  if (catalogStableIdV6(activeRecipe) === id) activeRecipe = recipe;
  return recipe;
}

async function hydrateCatalogRecipeV6(recipe) {
  if (!recipe?.compact) return recipe;
  const id = catalogStableIdV6(recipe);
  if (!id) return recipe;
  if (!catalogDetailCacheV6.has(id)) {
    const request = kutnoApi.recipeDetail(id, { portions: Number(recipe.portions) || 2 })
      .then((data) => {
        if (!data?.recipe) throw new Error("Полный рецепт не найден");
        const full = {
          ...data.recipe,
          id: data.recipe.id || id,
          compact: false,
          matching: recipe.matching,
          missing: Array.isArray(recipe.missing) ? recipe.missing : data.recipe.missing,
          uses: Array.isArray(recipe.uses) ? recipe.uses : data.recipe.uses,
          why: recipe.why || data.recipe.why,
        };
        replaceHydratedRecipeV6(full);
        return full;
      })
      .catch((error) => {
        catalogDetailCacheV6.delete(id);
        throw error;
      });
    catalogDetailCacheV6.set(id, request);
  }
  return catalogDetailCacheV6.get(id);
}

window.kutnoHydrateRecipe = hydrateCatalogRecipeV6;

const toggleFavoriteBeforeCatalogHydrationV6 = toggleFavorite;
toggleFavorite = async function toggleFavoriteWithCatalogHydrationV6(recipe, trigger) {
  if (!recipe?.compact) return toggleFavoriteBeforeCatalogHydrationV6(recipe, trigger);
  try {
    const full = await hydrateCatalogRecipeV6(recipe);
    return toggleFavoriteBeforeCatalogHydrationV6(full, trigger);
  } catch (error) {
    kutnoApi.telemetry("recipe_detail_failed", {
      id: catalogStableIdV6(recipe),
      action: "favorite",
      message: error instanceof Error ? error.message : String(error || ""),
    }, "error");
  }
};

if (window.kutnoBridge) {
  window.kutnoBridge.openRecipe = async function openHydratedRecipeV6(options = {}) {
    const candidate = options.recipe || kutnoBridgeFindRecipe(options.id, options.title);
    try {
      const full = candidate?.compact ? await hydrateCatalogRecipeV6(candidate) : candidate;
      return kutnoBridgeOpenRecipe({ ...options, recipe: full || options.recipe || null });
    } catch {
      return false;
    }
  };
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-open-recipe]");
  if (!target) return;
  const source = selectRecipeSource(target.dataset.recipeSource);
  const recipe = source[Number(target.dataset.openRecipe)];
  if (!recipe?.compact) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  target.setAttribute("aria-busy", "true");

  hydrateCatalogRecipeV6(recipe).then((full) => {
    activeRecipe = full;
    cookingMode = false;
    cookingStep = 0;
    stopCookingTimer();
    renderOverlayLayer({ animateRecipe: true });
    document.body.classList.add("no-scroll");
    document.querySelector(".recipe-sheet [data-action='close-recipe']")?.focus();
  }).catch((error) => {
    kutnoApi.telemetry("recipe_detail_failed", {
      id: catalogStableIdV6(recipe),
      action: "open",
      message: error instanceof Error ? error.message : String(error || ""),
    }, "error");
    target.removeAttribute("aria-busy");
  });
}, true);

function prefetchCatalogRecipeV6(event) {
  const target = event.target.closest?.("[data-open-recipe]");
  if (!target) return;
  const source = selectRecipeSource(target.dataset.recipeSource);
  const recipe = source[Number(target.dataset.openRecipe)];
  if (!recipe?.compact) return;
  hydrateCatalogRecipeV6(recipe).catch(() => {});
}

app.addEventListener("pointerover", prefetchCatalogRecipeV6, { passive: true });
app.addEventListener("focusin", prefetchCatalogRecipeV6);
