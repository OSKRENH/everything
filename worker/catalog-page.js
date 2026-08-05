import { enrichRecipeSemantics } from "../src/ingredient-semantics-v3.js";
import { CATALOG_VERSION, INGREDIENT_GLOSSARY, WORLD_RECIPE_CATALOG } from "./recipe-catalog.js";
import { manualRecipesForPortions } from "./manual-recipes.js";
import { decodeCatalogCursor, encodeCatalogCursor } from "./catalog-cursor.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 12;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
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
  else if (["шт.", "зубч.", "гол.", "пал."].includes(unit)) rounded = Math.max(0.25, Math.round(value * 4) / 4);
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
    source: {
      id: `catalog:${recipe.id}`,
      name: recipe.source?.name || "Кутно · мировая классика",
      type: "kutno-catalog",
      note: recipe.source?.note || "Редакционная версия традиционной рецептуры",
      url: /^https:\/\//i.test(recipe.source?.url || "") ? recipe.source.url : "",
      license: String(recipe.source?.license || ""),
    },
  };
}

function finalManualRecipe(recipe, portions) {
  return {
    ...recipe,
    id: String(recipe.id || recipe.source?.id || `manual:${normalized(recipe.title)}`),
    portions: Number(recipe.portions) || portions,
    match: null,
    missing: Array.isArray(recipe.missing) ? recipe.missing : [],
    uses: Array.isArray(recipe.uses) ? recipe.uses : [],
    why: recipe.why || "Проверенный холодный рецепт без специальной техники",
  };
}

function catalogSources(portions) {
  const seenTitles = new Set();
  const sources = [];
  for (const recipe of WORLD_RECIPE_CATALOG) {
    const title = normalized(recipe?.title);
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);
    sources.push({ kind: "world", recipe });
  }
  for (const recipe of manualRecipesForPortions(portions)) {
    const title = normalized(recipe?.title);
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);
    sources.push({ kind: "manual", recipe });
  }
  return sources;
}

function contextFromUrl(url) {
  const baseIngredients = url.searchParams.getAll("base");
  return {
    ingredients: url.searchParams.getAll("ingredient"),
    priorityIngredients: url.searchParams.getAll("priority"),
    equipment: url.searchParams.getAll("equipment"),
    ...(baseIngredients.length ? { baseIngredients } : {}),
  };
}

export async function serveCatalogPage(request, requestId = "") {
  const url = new URL(request.url);
  const portions = Math.min(8, Math.max(1, Number(url.searchParams.get("portions")) || 2));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = decodeCatalogCursor(url.searchParams.get("cursor") || "");
  const sources = catalogSources(portions);
  const pageSources = sources.slice(offset, offset + limit);
  const context = contextFromUrl(url);
  const recipes = pageSources.map(({ kind, recipe }) => {
    const finalRecipe = kind === "world"
      ? worldRecipeForPortions(recipe, portions)
      : finalManualRecipe(recipe, portions);
    return enrichRecipeSemantics(finalRecipe, context);
  });
  const nextOffset = offset + pageSources.length;
  const nextCursor = nextOffset < sources.length ? encodeCatalogCursor(nextOffset) : "";
  return json({
    recipes,
    total: sources.length,
    nextCursor,
    page: Math.floor(offset / limit) + 1,
    limit,
    catalogVersion: CATALOG_VERSION,
  }, 200, {
    ...(requestId ? { "x-request-id": requestId } : {}),
    "x-kutno-catalog-page": String(Math.floor(offset / limit) + 1),
  });
}
