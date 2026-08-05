let catalogIndex = [];
let catalogFacets = { cuisines: [], difficulties: [], courses: [], proteins: [] };

function safeCatalogFacetList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function fallbackCatalogIndex(recipes = catalogRecipes) {
  return (Array.isArray(recipes) ? recipes : []).map((recipe) => ({
    id: recipeIdentity(recipe),
    title: String(recipe?.title || ""),
    subtitle: String(recipe?.subtitle || ""),
    cuisine: String(recipe?.cuisine || "Другая кухня"),
    flag: String(recipe?.flag || "🌍"),
    course: String(recipe?.course || "основное"),
    protein: String(recipe?.protein || "без мяса"),
    difficulty: String(recipe?.difficulty || "легко"),
    minutes: Number(recipe?.minutes) || 0,
    ingredients: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => String(item?.name || "")).filter(Boolean),
    searchable: normalize([
      recipe?.title,
      recipe?.subtitle,
      recipe?.cuisine,
      ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((item) => item?.name) : []),
    ].join(" ")),
  }));
}

function captureCatalogMetadata(page, { replace = false, fallback = false } = {}) {
  if (Array.isArray(page?.index) && page.index.length) catalogIndex = page.index;
  else if (replace && (fallback || !catalogIndex.length)) catalogIndex = fallbackCatalogIndex(page?.recipes);

  if (page?.facets && typeof page.facets === "object") {
    catalogFacets = {
      cuisines: safeCatalogFacetList(page.facets.cuisines),
      difficulties: safeCatalogFacetList(page.facets.difficulties),
      courses: safeCatalogFacetList(page.facets.courses),
      proteins: safeCatalogFacetList(page.facets.proteins),
    };
  } else if (replace && !catalogFacets.cuisines.length) {
    const index = catalogIndex.length ? catalogIndex : fallbackCatalogIndex(page?.recipes);
    const cuisines = [...new Map(index.map((recipe) => [recipe.cuisine, {
      value: recipe.cuisine,
      flag: recipe.flag || "🌍",
    }])).values()];
    cuisines.sort((first, second) => {
      if (first.value === "Россия") return -1;
      if (second.value === "Россия") return 1;
      return first.value.localeCompare(second.value, "ru");
    });
    catalogFacets = { ...catalogFacets, cuisines };
  }
}

const catalogApplyPageBeforeFacets = applyCatalogPage;
applyCatalogPage = function applyCatalogPageWithFacets(page, options = {}) {
  captureCatalogMetadata(page, options);
  return catalogApplyPageBeforeFacets(page, options);
};

catalogCuisines = function completeCatalogCuisines() {
  const values = catalogFacets.cuisines.map((item) => typeof item === "string" ? item : item?.value).filter(Boolean);
  if (values.length) return values;
  return [...new Set((catalogIndex.length ? catalogIndex : fallbackCatalogIndex()).map((recipe) => recipe.cuisine))].filter(Boolean).sort((first, second) => {
    if (first === "Россия") return -1;
    if (second === "Россия") return 1;
    return first.localeCompare(second, "ru");
  });
};

cuisineLabel = function completeCuisineLabel(cuisine) {
  const facet = catalogFacets.cuisines.find((item) => (typeof item === "string" ? item : item?.value) === cuisine);
  const facetFlag = typeof facet === "object" ? facet?.flag : "";
  const indexFlag = catalogIndex.find((recipe) => recipe.cuisine === cuisine)?.flag;
  const loadedFlag = catalogRecipes.find((recipe) => recipe.cuisine === cuisine)?.flag;
  return `${facetFlag || indexFlag || loadedFlag || "🌍"} ${cuisine}`;
};

function catalogHasStaticFilters() {
  return Boolean(
    normalize(catalogQuery)
    || catalogCuisine !== "все"
    || catalogDifficulty !== "все"
    || catalogCourse !== "все"
    || catalogProtein !== "все"
    || Number(catalogMaxMinutes) > 0
  );
}

function catalogStaticTotal() {
  const index = catalogIndex.length ? catalogIndex : fallbackCatalogIndex();
  if (!index.length) return Math.max(catalogTotal, catalogRecipes.length);
  const query = normalize(catalogQuery);
  return index.filter((recipe) => {
    const cuisineMatches = catalogCuisine === "все" || recipe.cuisine === catalogCuisine;
    const difficultyMatches = catalogDifficulty === "все" || difficultyValue(recipe.difficulty) === catalogDifficulty;
    const courseMatches = catalogCourse === "все" || recipe.course === catalogCourse;
    const proteinMatches = catalogProtein === "все" || recipe.protein === catalogProtein;
    const timeMatches = !catalogMaxMinutes || Number(recipe.minutes) <= Number(catalogMaxMinutes);
    const searchable = recipe.searchable || normalize([
      recipe.title,
      recipe.subtitle,
      recipe.cuisine,
      ...(Array.isArray(recipe.ingredients) ? recipe.ingredients : []),
    ].join(" "));
    return cuisineMatches && difficultyMatches && courseMatches && proteinMatches && timeMatches && (!query || searchable.includes(query));
  }).length;
}

const catalogLoadUntilFilteredBeforeFacets = loadUntilNextFilteredRecipe;
loadUntilNextFilteredRecipe = async function loadAllPagesUntilFilteredRecipe(previousFilteredCount) {
  let attempts = 0;
  let filteredCount = previousFilteredCount;
  const maximumAttempts = Math.max(1, Math.ceil(Math.max(catalogTotal, catalogRecipes.length) / CATALOG_PAGE_SIZE) + 1);
  while (catalogNextCursor && attempts < maximumAttempts && filteredCount <= previousFilteredCount) {
    const result = await loadNextCatalogPage();
    if (!result.loaded) break;
    attempts += 1;
    filteredCount = currentFilteredCatalog().length;
  }
  return filteredCount;
};

const catalogUpdateBeforeFacets = updateCatalogResults;
updateCatalogResults = function catalogResultsWithFullTotal() {
  catalogUpdateBeforeFacets();
  const count = document.querySelector(".catalog-count");
  if (!count) return;

  const filtered = currentFilteredCatalog();
  const total = Math.max(catalogTotal, catalogIndex.length, catalogRecipes.length);
  if (catalogAvailability !== "все") {
    count.innerHTML = `Показано — ${filtered.length.toString().padStart(2, "0")} из ${total.toString().padStart(2, "0")}${state.ingredients.length ? matchingSummary(filtered) : ""}`;
    return;
  }

  const exactTotal = catalogStaticTotal();
  const label = catalogHasStaticFilters() ? "Найдено" : "В базе";
  count.innerHTML = `${label} — ${exactTotal.toString().padStart(2, "0")}${state.ingredients.length ? matchingSummary(filtered) : ""}`;
};
