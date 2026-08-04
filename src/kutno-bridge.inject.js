
function kutnoBridgeClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function kutnoBridgeAllRecipes() {
  const seen = new Set();
  return [activeRecipe, ...favoriteRecipes, ...catalogRecipes, ...recipes].filter((recipe) => {
    if (!recipe) return false;
    const id = recipeId(recipe);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function kutnoBridgeFindRecipe(id, title) {
  const normalizedTitle = normalize(String(title || ""));
  const all = kutnoBridgeAllRecipes();
  return all.find((recipe) => id && recipeId(recipe) === id)
    || all.find((recipe) => normalizedTitle && normalize(String(recipe.title || "")) === normalizedTitle)
    || null;
}

function kutnoBridgeResumeTimer(endsAt) {
  clearInterval(cookingTimerInterval);
  cookingTimerInterval = null;
  const target = Number(endsAt) || 0;
  if (target <= Date.now()) {
    cookingTimerEndsAt = 0;
    cookingTimer = null;
    return;
  }
  cookingTimerEndsAt = target;
  cookingTimer = Math.max(1, Math.ceil((target - Date.now()) / 60000));
  const update = () => {
    const output = document.querySelector("[data-cooking-timer-output]");
    if (output) output.textContent = timerLabel();
    if (cookingTimerEndsAt && Date.now() >= cookingTimerEndsAt) {
      clearInterval(cookingTimerInterval);
      cookingTimerInterval = null;
      cookingTimerEndsAt = 0;
      cookingTimer = null;
      if (output) output.textContent = "Готово";
      navigator.vibrate?.([120, 80, 120]);
    }
  };
  update();
  cookingTimerInterval = setInterval(update, 1000);
}

async function kutnoBridgeOpenRecipe({ id = "", title = "", recipe: suppliedRecipe = null, animate = true } = {}) {
  let recipe = suppliedRecipe ? normalizeStoredFavorite(suppliedRecipe) : kutnoBridgeFindRecipe(id, title);
  if (!recipe && !catalogRecipes.length) {
    await loadCatalog();
    recipe = kutnoBridgeFindRecipe(id, title);
  }
  if (!recipe) return false;
  activeRecipe = recipe;
  cookingMode = false;
  cookingStep = 0;
  stopCookingTimer();
  renderOverlayLayer({ animateRecipe: animate });
  document.body.classList.add("no-scroll");
  return true;
}

async function kutnoBridgeRestoreSwipeSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.swipeHistory) || !Array.isArray(snapshot.favoriteRecipes)) return false;
  const previousFavorites = kutnoBridgeClone(favoriteRecipes);
  swipeHistory = kutnoBridgeClone(snapshot.swipeHistory).slice(0, 500);
  favoriteRecipes = kutnoBridgeClone(snapshot.favoriteRecipes).slice(0, 100).map(normalizeStoredFavorite);
  swipeIndex = Math.max(0, Math.min(Number(snapshot.swipeIndex) || 0, swipeRecipes.length));
  swipeBusy = false;
  swipeGesture = null;
  localStorage.setItem(SWIPE_HISTORY_KEY, JSON.stringify(swipeHistory));
  saveFavoritesLocally();
  updateFavoritesNav();
  if (currentView === "swipe") refreshSwipeDeck();
  else if (currentView === "favorites") renderMainView();

  if (authUser) {
    await syncKitchen();
    const before = new Map(previousFavorites.map((recipe) => [recipeId(recipe), recipe]));
    const after = new Map(favoriteRecipes.map((recipe) => [recipeId(recipe), recipe]));
    await Promise.all([
      ...[...before.keys()].filter((id) => !after.has(id)).map((id) => fetch(`/api/favorites/${encodeURIComponent(id)}`, { method: "DELETE" })),
      ...[...after.entries()].filter(([id]) => !before.has(id)).map(([, recipe]) => fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipe }),
      })),
    ]).catch(() => {});
  }
  return true;
}

window.kutnoBridge = {
  version: 3,
  getAuthUser() {
    return authUser ? kutnoBridgeClone(authUser) : null;
  },
  getKitchenState() {
    return kutnoBridgeClone(state);
  },
  setPriorityIngredients(values, { render = true } = {}) {
    const selected = new Set(state.ingredients.map(normalize));
    state.priorityIngredients = (Array.isArray(values) ? values : [])
      .map((value) => normalize(String(value || "")))
      .filter((value, index, list) => value && selected.has(value) && list.indexOf(value) === index)
      .slice(0, 3);
    saveState();
    if (render) renderMainView();
    return kutnoBridgeClone(state.priorityIngredients);
  },
  getCatalogRecipes() {
    return kutnoBridgeClone(catalogRecipes);
  },
  rerankCatalog() {
    try {
      catalogRecipes = orderCatalogRecipes(catalogRecipes);
      resetSwipeDeck();
      if (currentView === "catalog") updateCatalogResults();
      if (currentView === "swipe") refreshSwipeDeck();
    } catch {
      if (currentView === "catalog") renderMainView();
    }
  },
  async loadNextCatalogPage() {
    return window.kutnoLoadNextCatalogPage?.() || false;
  },
  getCurrentRecipe() {
    return activeRecipe ? { id: recipeId(activeRecipe), recipe: kutnoBridgeClone(activeRecipe) } : null;
  },
  getRecipeId(recipe) {
    return recipeId(recipe);
  },
  async openRecipe(options) {
    return kutnoBridgeOpenRecipe(options);
  },
  addIngredients(values) {
    const list = Array.isArray(values) ? values : [values];
    addIngredients(list);
    return kutnoBridgeClone(state.ingredients);
  },
  getSwipeSnapshot() {
    return {
      swipeIndex,
      swipeHistory: kutnoBridgeClone(swipeHistory),
      favoriteRecipes: kutnoBridgeClone(favoriteRecipes),
    };
  },
  async restoreSwipeSnapshot(snapshot) {
    return kutnoBridgeRestoreSwipeSnapshot(snapshot);
  },
  getCookingSnapshot() {
    if (!activeRecipe || !cookingMode) return null;
    return {
      recipeId: recipeId(activeRecipe),
      title: activeRecipe.title,
      recipe: kutnoBridgeClone(activeRecipe),
      step: cookingStep,
      timerEndsAt: cookingTimerEndsAt || 0,
      updatedAt: Date.now(),
    };
  },
  async restoreCookingSession(session) {
    if (!session) return false;
    const opened = await kutnoBridgeOpenRecipe({
      id: session.recipeId,
      title: session.title,
      recipe: session.recipe || null,
      animate: true,
    });
    if (!opened || !activeRecipe) return false;
    cookingMode = true;
    cookingStep = Math.max(0, Math.min(Number(session.step) || 0, Math.max(0, (activeRecipe.steps?.length || 1) - 1)));
    kutnoBridgeResumeTimer(session.timerEndsAt);
    try {
      cookingWakeLock = await navigator.wakeLock?.request("screen");
    } catch {
      cookingWakeLock = null;
    }
    renderOverlayLayer();
    return true;
  },
  async syncKitchen() {
    await syncKitchen();
  },
};

window.dispatchEvent(new CustomEvent("kutno:bridge-ready"));