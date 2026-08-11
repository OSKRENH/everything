import { mkdir, rm, writeFile } from "node:fs/promises";
import { catalogSources, fullRecipeForSource, sourceIdentity } from "./catalog-source.mjs";
import { CATALOG_VERSION } from "../worker/catalog-version.js";
import {
  DEFAULT_BASE_INGREDIENTS,
  INGREDIENT_AUTOCOMPLETE,
  SUGGESTED_BASE_INGREDIENTS,
  canonicalIngredient,
  ingredientMatch,
  ingredientRole,
  normalizeIngredient,
} from "../src/ingredient-semantics-v3.js";
import { RECIPE_PHOTO_CATALOG } from "../worker/recipe-photo-catalog.js";
import { INGREDIENT_GLOSSARY } from "./data/recipe-catalog-source.js";

const generatedDir = new URL("../worker/generated/", import.meta.url);
const bodiesDir = new URL("../public/recipe-data/", import.meta.url);
const FAST_EQUIVALENT_TERMS = new Map([
  ["яйцо", "яйца"],
  ["яйца", "яйца"],
]);
const NO_SELECTED_BASE = ["__kutno_no_selected_base__"];
const PHOTO_SLUG_BY_ID = new Map(RECIPE_PHOTO_CATALOG.map(({ id, slug }) => [String(id || ""), String(slug || "")]).filter(([id, slug]) => id && slug));

function storageKey(id) {
  return Buffer.from(String(id), "utf8").toString("base64url");
}

function fastNormalizedTerm(value = "") {
  const term = normalizeIngredient(value);
  return FAST_EQUIVALENT_TERMS.get(term) || term;
}

function fastPrefixes(value = "") {
  return String(value).split(/[\s-]+/).filter((word) => word.length >= 4).map((word) => word.slice(0, 4));
}

function precomputedMatchIndex(ingredients = []) {
  const terms = [...new Set(ingredients
    .flatMap((item) => [item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])])
    .map((value) => fastNormalizedTerm(value))
    .filter(Boolean))];
  return {
    terms,
    prefixes: [...new Set(terms.flatMap((term) => fastPrefixes(term)))],
  };
}

function recipePhoto(id) {
  const slug = PHOTO_SLUG_BY_ID.get(String(id || ""));
  if (!slug) return null;
  return {
    square: `https://kutno.ru/img/${slug}-1x1.webp`,
    page: `https://kutno.ru/img/${slug}-4x3.webp`,
    social: `https://kutno.ru/img/${slug}-16x9.webp`,
  };
}

function compactSource(source) {
  const full = fullRecipeForSource(source, 2);
  const id = sourceIdentity(source.kind, source.recipe);
  const ingredients = (Array.isArray(full?.ingredients) ? full.ingredients : []).map((item, index) => ({
    name: String(item?.name || ""),
    amount: String(item?.amount || ""),
    aliases: Array.isArray(item?.aliases) ? item.aliases.map(String).filter(Boolean) : [],
    pantry: item?.pantry === true,
    ...(item?.role ? { role: String(item.role) } : {}),
    roleNoBase: ingredientRole(item, full, index, NO_SELECTED_BASE),
    semanticIds: [...new Set([item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])]
      .map((value) => canonicalIngredient(value))
      .filter(Boolean))],
  }));
  const matchIndex = precomputedMatchIndex(ingredients);
  const photo = recipePhoto(id);
  return {
    id,
    storageKey: storageKey(id),
    title: String(full?.title || source.recipe?.title || ""),
    subtitle: String(full?.subtitle || ""),
    cuisine: String(full?.cuisine || "Другая кухня"),
    flag: String(full?.flag || "🌍"),
    course: String(full?.course || "основное"),
    protein: String(full?.protein || "без мяса"),
    minutes: Number(full?.minutes) || 30,
    difficulty: String(full?.difficulty || "легко"),
    portions: 2,
    equipment: Array.isArray(full?.equipment) ? full.equipment.map(String) : [],
    ingredients,
    matchTerms: matchIndex.terms,
    matchPrefixes: matchIndex.prefixes,
    nutrition: { calories: Number(full?.nutrition?.calories) || 0 },
    source: full?.source || source.recipe?.source || {},
    why: String(full?.why || "Проверенный рецепт Кутно"),
    hasPhoto: Boolean(photo),
    photo,
  };
}

function precomputedSemanticRuntime(recipes) {
  const terms = new Set([
    ...INGREDIENT_AUTOCOMPLETE,
    ...DEFAULT_BASE_INGREDIENTS,
    ...SUGGESTED_BASE_INGREDIENTS,
  ]);
  for (const recipe of recipes) {
    for (const item of recipe.ingredients || []) {
      if (item?.name) terms.add(item.name);
      for (const alias of item?.aliases || []) if (alias) terms.add(alias);
    }
  }

  const aliases = {};
  const readable = {};
  const semanticAliases = [];
  for (const term of terms) {
    const normalized = normalizeIngredient(term);
    const id = canonicalIngredient(term);
    if (!normalized || !id) continue;
    aliases[normalized] = id;
    if (!readable[id]) readable[id] = String(term);
    if (!id.startsWith("raw:")) semanticAliases.push([normalized, id]);
  }

  const sortedSemanticAliases = [...new Map(semanticAliases.map((entry) => [entry[0], entry])).values()]
    .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], "ru"));
  const semanticIds = [...new Set(Object.values(aliases).filter((id) => !String(id).startsWith("raw:")))];
  const relations = {};
  for (const required of semanticIds) {
    const row = {};
    const requiredName = readable[required];
    if (!requiredName) continue;
    for (const owned of semanticIds) {
      const ownedName = readable[owned];
      if (!ownedName) continue;
      const type = ingredientMatch(requiredName, ownedName).type;
      if (type !== "none" && !(type === "exact" && required === owned)) row[owned] = type;
    }
    if (Object.keys(row).length) relations[required] = row;
  }

  return {
    aliases,
    semanticAliases: sortedSemanticAliases,
    relations,
    readable,
    defaultBase: [...DEFAULT_BASE_INGREDIENTS],
  };
}

await rm(generatedDir, { recursive: true, force: true });
await rm(bodiesDir, { recursive: true, force: true });
await mkdir(generatedDir, { recursive: true });
await mkdir(bodiesDir, { recursive: true });

const sources = catalogSources(2);
const compact = sources.map(compactSource);
const matching = precomputedSemanticRuntime(compact);
const routeRuntime = compact.map(({ id, storageKey, title }) => ({ id, storageKey, title }));

await writeFile(new URL("catalog-runtime.js", generatedDir), [
  `// Generated by scripts/generate-recipe-runtime.mjs. Do not edit by hand.`,
  `export const CATALOG_VERSION = ${JSON.stringify(CATALOG_VERSION)};`,
  `export const RUNTIME_RECIPES = ${JSON.stringify(routeRuntime)};`,
  "",
].join("\n"));
await writeFile(new URL("glossary-runtime.js", generatedDir), `// Generated by scripts/generate-recipe-runtime.mjs.\nexport const INGREDIENT_GLOSSARY = ${JSON.stringify(INGREDIENT_GLOSSARY)};\n`);
await writeFile(new URL("catalog-runtime.json", bodiesDir), JSON.stringify({ catalogVersion: CATALOG_VERSION, matching, recipes: compact }));

for (const source of sources) {
  const id = sourceIdentity(source.kind, source.recipe);
  const variants = {};
  for (let portions = 1; portions <= 8; portions += 1) variants[String(portions)] = fullRecipeForSource(source, portions);
  await writeFile(new URL(`${storageKey(id)}.json`, bodiesDir), JSON.stringify({ id, variants }));
}

console.log(`Generated ${compact.length} compact recipes with precomputed semantic matching, photo metadata, lightweight route index and ${sources.length} recipe body files.`);
