import { INGREDIENT_GLOSSARY, WORLD_RECIPE_CATALOG } from "../worker/recipe-catalog.js";
import { manualRecipesForPortions } from "../worker/manual-recipes.js";
import { simpleRecipesForPortions } from "../worker/simple-recipes.js";
import { expandedHomeRecipesForPortions } from "../worker/home-recipes-expanded.js";
import { finishHomeRecipesForPortions } from "../worker/home-recipes-finish.js";

function normalized(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

function displayAmount(item, portions, baseServings) {
  if (typeof item?.amount !== "number") return String(item?.amount || "по вкусу");
  const value = item.amount * portions / Math.max(1, Number(baseServings) || portions);
  const unit = String(item.unit || "").trim();
  const name = normalized(item?.name);
  if (item?.pantry === true && /соль|перец|паприк|спец|приправа|зелень/.test(name)) return "по вкусу";
  let rounded = value;
  if (unit === "г" || unit === "мл") rounded = Math.max(1, Math.round(value / 5) * 5);
  else if (/^(?:шт\.?|зубч\.?|гол\.?)$/i.test(unit)) rounded = Math.max(1, Math.ceil(value));
  else rounded = Math.max(0.25, Math.round(value * 4) / 4);
  const displayed = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${displayed} ${unit}`.trim();
}

function normalizePreparedIngredient(item) {
  const next = { ...item };
  const name = normalized(next?.name);
  if (next?.pantry === true && /соль|перец|паприк|спец|приправа|зелень/.test(name)) {
    next.amount = "по вкусу";
    return next;
  }
  const amount = String(next?.amount || "").trim();
  const piece = amount.match(/^(\d+(?:[.,]\d+)?)\s*(шт\.?|зубч\.?|гол\.?)$/i);
  if (piece) next.amount = `${Math.max(1, Math.ceil(Number(piece[1].replace(",", "."))))} ${piece[2]}`;
  return next;
}

function glossaryFor(name = "") {
  const signature = normalized(name);
  return Object.entries(INGREDIENT_GLOSSARY).find(([key]) => {
    const glossarySignature = normalized(key);
    return signature === glossarySignature || signature.includes(glossarySignature) || (signature.length >= 8 && glossarySignature.includes(signature));
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
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(normalizePreparedIngredient),
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
  finishHomeRecipesForPortions(targetPortions).forEach((recipe) => add("home", recipe));
  WORLD_RECIPE_CATALOG.forEach((recipe) => add("world", recipe));
  manualRecipesForPortions(targetPortions).forEach((recipe) => add("manual", recipe));
  return sources;
}

export function sourceIdentity(kind, recipe) {
  if (kind === "world") return `catalog:${recipe.id}`;
  return String(recipe.id || recipe.source?.id || `${kind}:${normalized(recipe.title)}`);
}

export function fullRecipeForSource(source, portions = 2) {
  if (!source) return null;
  if (source.kind === "world") return worldRecipeForPortions(source.recipe, portions);
  return finalPreparedRecipe(source.recipe, portions, source.kind);
}
