import { enrichRecipeSemantics } from "../src/ingredient-semantics-v3.js";
import { decodeCatalogCursor, encodeCatalogCursor } from "./catalog-cursor.js";
import { loadRuntimeRecipes } from "./catalog-runtime-store.js";
import { CATALOG_VERSION, RUNTIME_RECIPES } from "./generated/catalog-runtime.js";
import { recipeImageSet } from "./recipe-images.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 12;
const STATIC_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=600";
const RECIPE_BODY_PREFIX = "recipe:";

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

const RUNTIME_BY_ID = new Map(RUNTIME_RECIPES.map((recipe) => [String(recipe.id), recipe]));

function compactIngredient(item) {
  return {
    name: String(item?.name || ""),
    aliases: Array.isArray(item?.aliases) ? item.aliases.map(String).filter(Boolean) : [],
    pantry: item?.pantry === true,
    ...(item?.role ? { role: String(item.role) } : {}),
  };
}

function compactRecipe(recipe, context = null) {
  const photo = recipeImageSet(recipe);
  const compact = {
    id: String(recipe.id),
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
    source: recipe.source || {},
    portions: Number(recipe.portions) || 2,
    missing: [],
    uses: [],
    why: recipe.why || "Проверенный рецепт Кутно",
    hasPhoto: Boolean(photo),
    photo,
  };
  return context ? enrichRecipeSemantics(compact, context) : compact;
}

export function catalogRuntimeRecipes() {
  return RUNTIME_RECIPES;
}

export async function catalogCompactRecipes(request = new Request("https://kutno.test/"), env = {}) {
  const runtime = await loadRuntimeRecipes(request, env);
  return runtime.map((recipe) => compactRecipe(recipe));
}

export function catalogRuntimeRecipe(id) {
  return RUNTIME_BY_ID.get(String(id || "")) || null;
}

function catalogIndexEntry(recipe) {
  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => String(item?.name || "").trim()).filter(Boolean);
  const cuisine = String(recipe?.cuisine || "Другая кухня");
  const photo = recipeImageSet(recipe);
  return {
    id: String(recipe.id),
    title: String(recipe.title || ""),
    cuisine,
    flag: String(recipe.flag || "🌍"),
    course: String(recipe.course || "основное"),
    protein: String(recipe.protein || "без мяса"),
    difficulty: String(recipe.difficulty || "легко"),
    minutes: Number(recipe.minutes) || 30,
    ingredients,
    searchable: normalized([recipe.title, cuisine, ...ingredients].join(" ")),
    hasPhoto: Boolean(photo),
    photo,
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

function catalogFacets(recipes) {
  const index = recipes.map(catalogIndexEntry);
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

function runtimeArgs(envOrRequestId = {}, requestId = "") {
  return typeof envOrRequestId === "string"
    ? { env: {}, requestId: envOrRequestId }
    : { env: envOrRequestId || {}, requestId: requestId || "" };
}

async function bodyFromKv(env, recipe) {
  if (!env?.RECIPE_BODIES?.get) return null;
  try {
    return await env.RECIPE_BODIES.get(`${RECIPE_BODY_PREFIX}${recipe.id}`, "json");
  } catch {
    return null;
  }
}

async function bodyFromAssets(request, env, recipe) {
  if (!env?.ASSETS?.fetch || !recipe?.storageKey) return null;
  const url = new URL(`/recipe-data/${recipe.storageKey}.json`, request.url);
  const response = await env.ASSETS.fetch(new Request(url, { method: "GET", headers: { accept: "application/json" } }));
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export async function loadRecipeBody(request, env, id, portions = 2) {
  const recipe = catalogRuntimeRecipe(id);
  if (!recipe) return null;
  const payload = await bodyFromKv(env, recipe) || await bodyFromAssets(request, env, recipe);
  const target = String(Math.min(8, Math.max(1, Number(portions) || 2)));
  return payload?.variants?.[target] || payload?.recipe || null;
}

export async function serveCatalogPage(request, envOrRequestId = {}, requestId = "") {
  const args = runtimeArgs(envOrRequestId, requestId);
  const runtime = await loadRuntimeRecipes(request, args.env);
  const url = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = decodeCatalogCursor(url.searchParams.get("cursor") || "");
  const pageRecipes = runtime.slice(offset, offset + limit);
  const context = contextFromUrl(url);
  const recipes = pageRecipes.map((recipe) => compactRecipe(recipe, context));
  const nextOffset = offset + pageRecipes.length;
  const nextCursor = nextOffset < runtime.length ? encodeCatalogCursor(nextOffset) : "";
  return json({
    recipes,
    total: runtime.length,
    nextCursor,
    page: Math.floor(offset / limit) + 1,
    limit,
    catalogVersion: CATALOG_VERSION,
    ...(offset === 0 ? { facets: catalogFacets(runtime) } : {}),
  }, 200, {
    ...(args.requestId ? { "x-request-id": args.requestId } : {}),
    "x-kutno-catalog-page": String(Math.floor(offset / limit) + 1),
  });
}

export async function serveCatalogIndex(request, envOrRequestId = {}, requestId = "") {
  const args = runtimeArgs(envOrRequestId, requestId);
  const runtime = await loadRuntimeRecipes(request, args.env);
  return json({
    index: runtime.map(catalogIndexEntry),
    facets: catalogFacets(runtime),
    total: runtime.length,
    catalogVersion: CATALOG_VERSION,
  }, 200, args.requestId ? { "x-request-id": args.requestId } : {});
}

export async function serveRecipeDetail(request, env, requestId = "") {
  const url = new URL(request.url);
  const rawId = decodeURIComponent(url.pathname.slice("/api/recipe/".length));
  const portions = Math.min(8, Math.max(1, Number(url.searchParams.get("portions")) || 2));
  if (!catalogRuntimeRecipe(rawId)) return json({ error: "Рецепт не найден" }, 404, requestId ? { "x-request-id": requestId } : {});
  const recipe = await loadRecipeBody(request, env, rawId, portions);
  if (!recipe) return json({ error: "Рецепт временно недоступен" }, 503, requestId ? { "x-request-id": requestId } : {});
  return json({ recipe, catalogVersion: CATALOG_VERSION }, 200, requestId ? { "x-request-id": requestId } : {});
}