import featureWorker from "./entry.js";
import { analyzeRecipe, enrichRecipeSemantics, MANUAL_EQUIPMENT } from "../src/ingredient-semantics-v3.js";
import { applyMatchingUserContext, matchingPayloadFromContext } from "../src/matching-user-context.js";
import { catalogSources, sourceIdentity } from "./catalog-page.js";

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
}

function requestWithJson(request, body) {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return new Request(request.url, { method: request.method, headers, body: JSON.stringify(body) });
}

function matchingContext(body = {}) {
  const user = matchingPayloadFromContext(body);
  return {
    ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
    priorityIngredients: [],
    equipment: Array.isArray(body.equipment) ? body.equipment : [],
    baseIngredients: Array.isArray(body.baseIngredients) ? body.baseIngredients : undefined,
    pantry: user.pantry,
    feedback: user.feedback,
  };
}

function normalizedTitle(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

function mergeRecipes(...groups) {
  const result = [];
  const seen = new Set();
  for (const recipe of groups.flat()) {
    if (!recipe?.title) continue;
    const key = String(recipe.id || recipe.source?.id || normalizedTitle(recipe.title));
    const title = normalizedTitle(recipe.title);
    if (seen.has(key) || result.some((item) => normalizedTitle(item.title) === title)) continue;
    seen.add(key);
    result.push(recipe);
  }
  return result;
}

function matchingAmount(source, item) {
  if (source.kind !== "world" || typeof item?.amount !== "number") return String(item?.amount || "");
  const value = item.amount * 2 / Math.max(1, Number(source.recipe.servings) || 2);
  const unit = String(item.unit || "").trim();
  let rounded = value;
  if (unit === "г" || unit === "мл") rounded = Math.max(5, Math.round(value / 5) * 5);
  else if (/шт/.test(unit)) rounded = Math.max(1, Math.round(value * 4) / 4);
  else rounded = Math.round(value * 4) / 4;
  const display = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${display} ${unit}`.trim();
}

function matchingRecipeFromSource(source) {
  const recipe = source.recipe;
  const id = sourceIdentity(source.kind, recipe);
  const sourceMeta = source.kind === "world"
    ? { id, name: recipe.source?.name || "Кутно · мировая классика", type: "kutno-catalog", note: recipe.source?.note || "Редакционная версия традиционной рецептуры", url: recipe.source?.url || "" }
    : { ...(recipe.source || {}), id };
  return {
    id,
    compact: true,
    title: String(recipe.title || ""),
    subtitle: String(recipe.subtitle || ""),
    cuisine: String(recipe.cuisine || "Другая кухня"),
    flag: String(recipe.flag || "🌍"),
    course: String(recipe.course || "основное"),
    protein: String(recipe.protein || "без мяса"),
    minutes: Number(recipe.minutes) || 30,
    difficulty: String(recipe.difficulty || "легко"),
    portions: 2,
    equipment: Array.isArray(recipe.equipment) ? recipe.equipment.map(String) : [],
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item) => ({
      name: String(item?.name || ""),
      amount: matchingAmount(source, item),
      aliases: Array.isArray(item?.aliases) ? item.aliases.map(String).filter(Boolean) : [],
      pantry: item?.pantry === true,
      ...(item?.role ? { role: String(item.role) } : {}),
    })),
    nutrition: { calories: Number(recipe.nutrition?.calories) || 0 },
    source: sourceMeta,
    missing: [],
    uses: [],
    why: recipe.why || (source.kind === "world" ? `Классическое блюдо кухни: ${recipe.cuisine}` : "Проверенный рецепт Кутно"),
  };
}

function matchingCatalog() {
  return catalogSources(2).map(matchingRecipeFromSource);
}

function recipePassesFilters(recipe, body) {
  if (body.course && body.course !== "все" && recipe.course !== body.course && !(body.course === "перекус" && ["закуска", "салат"].includes(recipe.course))) return false;
  const excluded = Array.isArray(body.excludeTitles) ? body.excludeTitles.map(normalizedTitle) : [];
  return !excluded.includes(normalizedTitle(recipe.title));
}

function groupAllowed(group, searchMode) {
  return searchMode === "plus-one" ? ["ready", "substitute", "one"].includes(group) : ["ready", "substitute"].includes(group);
}

function analyzeWithContext(recipe, context) {
  return applyMatchingUserContext(recipe, analyzeRecipe(recipe, context), context);
}

function enrichedWithContext(recipe, context, analysis = analyzeWithContext(recipe, context)) {
  const enriched = enrichRecipeSemantics(recipe, context);
  return {
    ...enriched,
    matching: {
      ...(enriched.matching || {}),
      group: analysis.group,
      score: analysis.score,
      reasons: analysis.reasons,
      missingRequired: analysis.requiredMissing.map((item) => item.name),
      missingOptional: analysis.optionalMissing.map((item) => item.name),
      substitutions: analysis.substitutions.map((item) => ({ ingredient: item.name, owned: item.match?.owned || "" })),
      missingEquipment: analysis.missingEquipment,
      quantityShortages: analysis.quantityShortages.map((item) => ({ name: item.name, have: `${item.have.quantity} ${item.have.unit}`.trim(), need: item.need })),
      preferencePenalty: analysis.preferencePenalty,
    },
  };
}

function verifiedSourceBonus(recipe) {
  if (recipe?.source?.type === "kutno-simple-catalog") return 70;
  if (recipe?.source?.type === "kutno-manual-catalog") return 55;
  if (recipe?.source?.type === "kutno-catalog") return 45;
  if (recipe?.source?.type === "generated") return -30;
  return 0;
}

function rankRecipes(catalog, body) {
  const context = matchingContext(body);
  return catalog
    .map((recipe) => {
      const analysis = analyzeWithContext(recipe, context);
      const enriched = enrichedWithContext(recipe, context, analysis);
      const usedCount = Array.isArray(enriched.uses) ? enriched.uses.length : 0;
      return { recipe: enriched, analysis, rank: analysis.score + verifiedSourceBonus(enriched) + Math.min(18, usedCount * 3) - Number(enriched.minutes || 0) / 120 };
    })
    .filter(({ recipe, analysis }) => recipePassesFilters(recipe, body) && groupAllowed(analysis.group, body.searchMode))
    .sort((a, b) => b.rank - a.rank || Number(a.recipe.minutes) - Number(b.recipe.minutes));
}

function compactMatchedRecipe(recipe) {
  const missingRequired = Array.isArray(recipe.matching?.missingRequired) ? recipe.matching.missingRequired : [];
  return {
    id: recipe.id,
    compact: true,
    title: recipe.title,
    subtitle: recipe.subtitle,
    cuisine: recipe.cuisine,
    flag: recipe.flag,
    course: recipe.course,
    protein: recipe.protein,
    minutes: recipe.minutes,
    difficulty: recipe.difficulty,
    portions: 2,
    equipment: recipe.equipment || [],
    ingredients: (recipe.ingredients || []).map((item) => ({ name: item.name, aliases: item.aliases || [], pantry: item.pantry === true, ...(item.role ? { role: item.role } : {}) })),
    nutrition: { calories: Number(recipe.nutrition?.calories) || 0 },
    source: recipe.source,
    matching: recipe.matching,
    missing: missingRequired.length ? missingRequired : Array.isArray(recipe.missing) ? recipe.missing : [],
    uses: Array.isArray(recipe.uses) ? recipe.uses : [],
    why: recipe.why,
  };
}

function ingredientUnlockSuggestions(catalog, body, limit = 6) {
  const context = matchingContext({ ...body, searchMode: "strict" });
  const owned = new Set(context.ingredients.map(normalizedTitle));
  const counts = new Map();
  for (const recipe of catalog) {
    if (!recipePassesFilters(recipe, { ...body, course: "все", excludeTitles: [] })) continue;
    const analysis = analyzeWithContext(recipe, context);
    if (analysis.missingEquipment?.length || analysis.requiredMissing?.length !== 1) continue;
    const name = String(analysis.requiredMissing[0]?.name || "").trim();
    const key = normalizedTitle(name);
    if (!name || !key || owned.has(key)) continue;
    const current = counts.get(key) || { name, count: 0 };
    current.count += 1;
    if (name.length < current.name.length) current.name = name;
    counts.set(key, current);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")).slice(0, limit);
}

async function runAiIdeas(body, request, env, ctx) {
  const { difficulty: _difficulty, maxMinutes: _maxMinutes, portions: _portions, ...unfilteredBody } = body;
  const generationBody = { ...unfilteredBody, portions: 2, equipment: [...new Set([...(body.equipment || []), ...MANUAL_EQUIPMENT])] };
  const response = await featureWorker.fetch(requestWithJson(request, generationBody), env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data) return { response, data: null, recipes: [] };
  const recipes = Array.isArray(data.recipes) ? rankRecipes(data.recipes, body).map((item) => item.recipe) : [];
  return { response, data, recipes };
}

function resultResponse(recipes, body, { source = "deterministic-catalog", suggestedExpansion = null, suggestions = [], extra = {} } = {}) {
  return json({ ...extra, recipes, suggestions, hasMore: false, source, relaxation: null, ...(suggestedExpansion ? { suggestedExpansion } : {}), originalFilters: { searchMode: body.searchMode, course: body.course } });
}

function expansionSuggestion(body, catalog) {
  if (body.searchMode !== "plus-one") {
    const plusOne = rankRecipes(catalog, { ...body, searchMode: "plus-one" });
    if (plusOne.length) return { code: "allow-one-purchase", title: "Есть варианты с одной покупкой", details: "Можно отдельно показать блюда, где не хватает ровно одного обязательного продукта.", count: plusOne.length };
  }
  if (body.course && body.course !== "все") {
    const withoutCourse = rankRecipes(catalog, { ...body, course: "все" });
    if (withoutCourse.length) return { code: "relax-filters", title: "Подходящие блюда есть в других разделах", details: "Продукты и техника останутся прежними; изменится только тип блюда.", count: withoutCourse.length };
  }
  return null;
}

function normalizedBody(body = {}) {
  return { ...body, maxMinutes: 0, portions: 2, priorityIngredients: [], difficulty: undefined, searchMode: body.searchMode === "plus-one" ? "plus-one" : "strict", course: ["все", "завтрак", "суп", "основное", "перекус"].includes(body.course) ? body.course : "все" };
}

async function smartGenerate(request, env, ctx) {
  const incoming = await request.clone().json().catch(() => ({}));
  if (!Array.isArray(incoming.ingredients) || !incoming.ingredients.length) return featureWorker.fetch(request, env, ctx);
  const body = normalizedBody(incoming);
  const catalog = matchingCatalog();
  const suggestions = ingredientUnlockSuggestions(catalog, body);
  const catalogRanked = rankRecipes(catalog, body).map(({ recipe }) => compactMatchedRecipe(recipe));

  if (catalogRanked.length && !incoming.aiIdeas) return resultResponse(catalogRanked, body, { suggestions });
  if (catalogRanked.length && incoming.aiIdeas) {
    const generated = await runAiIdeas(body, request, env, ctx);
    return resultResponse(mergeRecipes(catalogRanked, generated.recipes), body, { source: generated.recipes.length ? "deterministic-plus-ai" : "deterministic-catalog", suggestions, extra: generated.data || {} });
  }

  const suggestedExpansion = expansionSuggestion(body, catalog);
  if (!incoming.aiIdeas) return resultResponse([], body, { suggestions, suggestedExpansion, extra: { error: suggestedExpansion?.title || "Для этого набора пока нет точного рецепта" } });
  const generated = await runAiIdeas(body, request, env, ctx);
  if (generated.recipes.length) return resultResponse(generated.recipes, body, { source: "workers-ai", suggestions, extra: generated.data || {} });
  if (!generated.data && !generated.response.ok) return generated.response;
  return resultResponse([], body, { suggestions, suggestedExpansion, extra: { error: suggestedExpansion?.title || "Добавьте ещё один основной продукт" } });
}

async function matchingSuggestions(request) {
  const url = new URL(request.url);
  const body = normalizedBody({ ingredients: url.searchParams.getAll("ingredient"), equipment: url.searchParams.getAll("equipment"), baseIngredients: url.searchParams.getAll("base"), course: "все", searchMode: "strict" });
  if (!body.ingredients.length) return json({ suggestions: [] });
  return json({ suggestions: ingredientUnlockSuggestions(matchingCatalog(), body) }, 200, { "cache-control": "public, max-age=60, s-maxage=300" });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/generate" && request.method === "POST") return smartGenerate(request, env, ctx);
    if (url.pathname === "/api/matching-suggestions" && request.method === "GET") return matchingSuggestions(request);
    return featureWorker.fetch(request, env, ctx);
  },
};
