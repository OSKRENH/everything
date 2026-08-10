import { enrichRecipeSemantics } from "../src/ingredient-semantics-v3.js";
import { CATALOG_VERSION, INGREDIENT_GLOSSARY, WORLD_RECIPE_CATALOG } from "./recipe-catalog.js";
import { manualRecipesForPortions } from "./manual-recipes.js";
import { simpleRecipesForPortions } from "./simple-recipes.js";
import { expandedHomeRecipesForPortions } from "./home-recipes-expanded.js";
import { decodeCatalogCursor, encodeCatalogCursor } from "./catalog-cursor.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 12;
const STATIC_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": status >= 400 ? "no-store" : STATIC_CACHE,
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function normalized(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

function displayAmount(item, portions, baseServings) {
  if (typeof item?.amount !== "number") return String(item?.amount || "по вкусу");
  const value = item.amount * portions / Math.max(1, Number(baseServings) || portions);
  const unit = String(item.unit || "").trim();
  let rounded = value;
  if (unit === "г" || unit === "мл") rounded = Math.max(1, Math.round(value / 5) * 5);
  else rounded = Math.max(0.25, Math.round(value * 4) / 4);
  const displayed = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${displayed} ${unit}`.trim();
}

function glossaryFor(name = "") {
  const signature = normalized(name);
  return Object.entries(INGREDIENT_GLOSSARY).find(([key]) => {
    const glossarySignature = normalized(key);
    return signature === glossarySignature
      || signature.includes(glossarySignature)
      || (signature.length >= 8 && glossarySignature.includes(signature));
  })?.[1];
}

function worldSource(recipe) {
  return {
    id: `catalog:${recipe.id}`,
    name: recipe.source?.name || "Кутно · мировая классика",
    type: "kutno-catalog",
    note: recipe.source?.note || "Редакционная версия традиционной рецептуры",
    url: /^https:\/\//i.test(recipe.source?.url || "") ? recipe.source.url : "",
    license: String(recipe.source?.license || ""),
  };
}

function worldRecipeForPortions(recipe, portions) {
  return {
    id: `catalog:${recipe.id}`,
    title: recipe.title,
    subtitle: recipe.subtitle,
    cuisine: recipe.cuisine,
    flag: recipe.flag || "🌍",
    course: recipe.course || "основное",
    protein: recipe.protein || "без мяса",
    minutes: Number(recipe.minutes) || 30,
    difficulty: String(recipe.difficulty || "легко"),
    match: null,
    missing: [],
    uses: [],
    equipment: Array.isArray(recipe.equipment) ? recipe.equipment : [],
    why: `Классическое блюдо кухни: ${recipe.cuisine}`,
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item) => {
      const info = glossaryFor(item.name);
      return {
        name: item.name,
        amount: displayAmount(item, portions, recipe.servings),
        aliases: Array.isArray(item.aliases) ? item.aliases : [],
        pantry: item.pantry === true,
        ...(item.role ? { role: String(item.role) } : {}),
        ...(item.note ? { note: String(item.note) } : {}),
        ...(info ? { info } : {}),
      };
    }),
    steps: (Array.isArray(recipe.steps) ? recipe.steps : []).map(String).filter(Boolean),
    nutrition: {
      calories: Number(recipe.nutrition?.calories) || 0,
      protein: Number(recipe.nutrition?.protein) || 0,
      fat: Number(recipe.nutrition?.fat) || 0,
      carbs: Number(recipe.nutrition?.carbs) || 0,
      estimated: true,
    },
    tip: String(recipe.tip || ""),
    portions,
    source: worldSource(recipe),
  };
}

function finalPreparedRecipe(recipe, portions, kind) {
  return {
    ...recipe,
    id: String(recipe.id || recipe.source?.id || `${kind}:${normalized(recipe.title)}`),
    portions: Number(recipe.portions) || portions,
    match: null,
    missing: Array.isArray(recipe.missing) ? recipe.missing : [],
    uses: Array.isArray(recipe.uses) ? recipe.uses : [],
    why: recipe.why || (kind === "simple" || kind === "home" ? "Простой домашний рецепт из продуктов, которые уже есть." : "Проверенный рецепт без лишних требований"),
  };
}

export function catalogSources(portions = 2) {
  const targetPortions = Math.min(8, Math.max(1, Number(portions) || 2));
  const seenTitles = new Set();
  const sources = [];
  const add = (kind, recipe) => {
    const title = normalized(recipe?.title);
    if (!title || seenTitles.has(title)) return;
    seenTitles.add(title);
    sources.push({ kind, recipe });
  };
  simpleRecipesForPortions(targetPortions).forEach((recipe) => add("simple", recipe));
  expandedHomeRecipesForPortions(targetPortions).forEach((recipe) => add("home", recipe));
  WORLD_RECIPE_CATALOG.forEach((recipe) => add("world", recipe));
  manualRecipesForPortions(targetPortions).forEach((recipe) => add("manual", recipe));
  return sources;
}

export function sourceIdentity(kind, recipe) {
  if (kind === "world") return `catalog:${recipe.id}`;
  return String(recipe.id || recipe.source?.id || `${kind}:${normalized(recipe.title)}`);
}

function sourceMeta(source) {
  if (source.kind === "world") return worldSource(source.recipe);
  return {
    ...(source.recipe.source || {}),
    id: sourceIdentity(source.kind, source.recipe),
  };
}

function compactIngredient(item) {
  return {
    name: String(item?.name || ""),
    aliases: Array.isArray(item?.aliases) ? item.aliases.map(String).filter(Boolean) : [],
    pantry: item?.pantry === true,
    ...(item?.role ? { role: String(item.role) } : {}),
  };
}

function compactRecipeForSource(source, context = null) {
  const recipe = source.recipe;
  const compact = {
    id: sourceIdentity(source.kind, recipe),
    compact: true,
    title: String(recipe.title || ""),
    subtitle: String(recipe.subtitle || ""),
    cuisine: String(recipe.cuisine || "Другая кухня"),
    flag: String(recipe.flag || "🌍"),
    course: String(recipe.course || "основное"),
    protein: String(recipe.protein || "без мяса"),
    minutes: Number(recipe.minutes) || 30,
    difficulty: String(recipe.difficulty || "легко"),
    equipment: Array.isArray(recipe.equipment) ? recipe.equipment.map(String) : [],
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(compactIngredient),
    nutrition: { calories: Number(recipe.nutrition?.calories) || 0 },
    source: sourceMeta(source),
    portions: Number(recipe.portions) || 2,
    missing: [],
    uses: [],
    why: recipe.why || (source.kind === "world" ? `Классическое блюдо кухни: ${recipe.cuisine}` : "Проверенный рецепт Кутно"),
  };
  return context ? enrichRecipeSemantics(compact, context) : compact;
}

export function catalogCompactRecipes() {
  return catalogSources(2).map((source) => compactRecipeForSource(source));
}

export function fullRecipeForSource(source, portions = 2) {
  if (!source) return null;
  if (source.kind === "world") return worldRecipeForPortions(source.recipe, portions);
  return finalPreparedRecipe(source.recipe, portions, source.kind);
}

function catalogIndexEntry(source) {
  const recipe = source.recipe;
  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => String(item?.name || "").trim()).filter(Boolean);
  const cuisine = String(recipe?.cuisine || "Другая кухня");
  return {
    id: sourceIdentity(source.kind, recipe),
    title: String(recipe.title || ""),
    cuisine,
    flag: String(recipe.flag || "🌍"),
    course: String(recipe.course || "основное"),
    protein: String(recipe.protein || "без мяса"),
    difficulty: String(recipe.difficulty || "легко"),
    minutes: Number(recipe.minutes) || 30,
    ingredients,
    searchable: normalized([recipe.title, cuisine, ...ingredients].join(" ")),
  };
}

function orderedUnique(values, preferred = []) {
  const unique = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  return unique.sort((first, second) => {
    const firstPreferred = preferred.indexOf(first);
    const secondPreferred = preferred.indexOf(second);
    if (firstPreferred !== -1 || secondPreferred !== -1) {
      if (firstPreferred === -1) return 1;
      if (secondPreferred === -1) return -1;
      return firstPreferred - secondPreferred;
    }
    return first.localeCompare(second, "ru");
  });
}

function catalogFacets(sources) {
  const index = sources.map(catalogIndexEntry);
  const cuisineFlags = Object.fromEntries(index.map((recipe) => [recipe.cuisine, recipe.flag]));
  return {
    cuisines: orderedUnique(index.map((recipe) => recipe.cuisine), ["Домашняя кухня", "Россия"]).map((value) => ({ value, flag: cuisineFlags[value] || "🌍" })),
    difficulties: orderedUnique(index.map((recipe) => recipe.difficulty), ["легко", "обычно", "сложно"]),
    courses: orderedUnique(index.map((recipe) => recipe.course), ["завтрак", "суп", "основное", "салат", "закуска", "перекус", "выпечка", "соус"]),
    proteins: orderedUnique(index.map((recipe) => recipe.protein), ["мясо", "рыба и морепродукты", "без мяса"]),
  };
}

function contextFromUrl(url) {
  const baseIngredients = url.searchParams.getAll("base");
  return {
    ingredients: url.searchParams.getAll("ingredient"),
    priorityIngredients: [],
    equipment: [],
    ...(baseIngredients.length ? { baseIngredients } : {}),
  };
}

export async function serveCatalogPage(request, requestId = "") {
  const url = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = decodeCatalogCursor(url.searchParams.get("cursor") || "");
  const sources = catalogSources(2);
  const pageSources = sources.slice(offset, offset + limit);
  const context = contextFromUrl(url);
  const recipes = pageSources.map((source) => compactRecipeForSource(source, context));
  const nextOffset = offset + pageSources.length;
  const nextCursor = nextOffset < sources.length ? encodeCatalogCursor(nextOffset) : "";
  return json({
    recipes,
    total: sources.length,
    nextCursor,
    page: Math.floor(offset / limit) + 1,
    limit,
    catalogVersion: CATALOG_VERSION,
    ...(offset === 0 ? { facets: catalogFacets(sources) } : {}),
  }, 200, {
    ...(requestId ? { "x-request-id": requestId } : {}),
    "x-kutno-catalog-page": String(Math.floor(offset / limit) + 1),
  });
}

export async function serveCatalogIndex(request, requestId = "") {
  const sources = catalogSources(2);
  return json({ index: sources.map(catalogIndexEntry), facets: catalogFacets(sources), total: sources.length, catalogVersion: CATALOG_VERSION }, 200, requestId ? { "x-request-id": requestId } : {});
}

export async function serveRecipeDetail(request, requestId = "") {
  const url = new URL(request.url);
  const rawId = decodeURIComponent(url.pathname.slice("/api/recipe/".length));
  const portions = Math.min(8, Math.max(1, Number(url.searchParams.get("portions")) || 2));
  const source = catalogSources(portions).find((item) => sourceIdentity(item.kind, item.recipe) === rawId);
  if (!source) return json({ error: "Рецепт не найден" }, 404, requestId ? { "x-request-id": requestId } : {});
  return json({ recipe: fullRecipeForSource(source, portions), catalogVersion: CATALOG_VERSION }, 200, requestId ? { "x-request-id": requestId } : {});
}
