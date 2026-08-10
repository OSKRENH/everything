import featureWorker from "./entry.js";
import { analyzeRecipe, enrichRecipeSemantics } from "../src/ingredient-semantics-v3.js";
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

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function matchingContext(body = {}) {
  const user = matchingPayloadFromContext(body);
  return {
    ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
    priorityIngredients: Array.isArray(body.priorityIngredients) ? body.priorityIngredients : [],
    // В основном сценарии бытовая техника не является фильтром. Духовка, блендер
    // и прочее остаются требованиями на карточке рецепта, но не прячут блюда.
    equipment: body.enforceEquipment === true && Array.isArray(body.equipment) ? body.equipment : [],
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

function matchingAmount(source, item, portions) {
  if (source.kind !== "world" || typeof item?.amount !== "number") return String(item?.amount || "");
  const value = item.amount * portions / Math.max(1, Number(source.recipe.servings) || 2);
  const unit = String(item.unit || "").trim();
  let rounded = value;
  if (unit === "г" || unit === "мл") rounded = Math.max(5, Math.round(value / 5) * 5);
  else if (/шт/.test(unit)) rounded = Math.max(1, Math.round(value * 4) / 4);
  else rounded = Math.round(value * 4) / 4;
  const display = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${display} ${unit}`.trim();
}

function matchingRecipeFromSource(source, portions) {
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
    portions,
    equipment: Array.isArray(recipe.equipment) ? recipe.equipment.map(String) : [],
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item) => ({
      name: String(item?.name || ""),
      amount: matchingAmount(source, item, portions),
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

function matchingCatalog(portions = 2) {
  return catalogSources(portions).map((source) => matchingRecipeFromSource(source, portions));
}

function difficultyRank(value = "") {
  const text = String(value).toLocaleLowerCase("ru-RU");
  if (/очень\s*прост/.test(text)) return 0;
  if (/легк|прост/.test(text)) return 1;
  if (/обыч|сред/.test(text)) return 2;
  if (/слож|труд/.test(text)) return 3;
  return 2;
}

function recipePassesFilters(recipe, body) {
  if (body.course && body.course !== "все" && recipe.course !== body.course && !(body.course === "перекус" && ["закуска", "салат"].includes(recipe.course))) return false;
  if (body.maxMinutes > 0 && Number(recipe.minutes) > body.maxMinutes) return false;
  if (body.difficulty) {
    const requested = difficultyRank(body.difficulty);
    if (difficultyRank(recipe.difficulty) > requested) return false;
  }
  const excluded = Array.isArray(body.excludeTitles) ? body.excludeTitles.map(normalizedTitle) : [];
  return !excluded.includes(normalizedTitle(recipe.title));
}

function groupAllowed(analysis) {
  // Никогда не обрываем путь пустым экраном: рядом с точными блюдами показываем
  // варианты с одной покупкой и «почти подходит» (не хватает двух-трёх продуктов).
  return (analysis.requiredMissing?.length || 0) <= 3;
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

function rankRecipes(catalog, body) {
  const context = matchingContext(body);
  return catalog
    .map((recipe) => {
      const analysis = analyzeWithContext(recipe, context);
      const enriched = enrichedWithContext(recipe, context, analysis);
      const exactRequired = analysis.exactAvailable.filter((item) => item.role === "required").length;
      return {
        recipe: enriched,
        analysis,
        missingCount: analysis.requiredMissing.length,
        exactRequired,
        substitutions: analysis.substitutions.length,
        optionalMissing: analysis.optionalMissing.length,
      };
    })
    .filter(({ recipe, analysis }) => recipePassesFilters(recipe, body) && groupAllowed(analysis))
    .sort((a, b) => a.missingCount - b.missingCount
      || b.exactRequired - a.exactRequired
      || a.substitutions - b.substitutions
      || a.optionalMissing - b.optionalMissing
      || Number(a.recipe.minutes) - Number(b.recipe.minutes)
      || a.recipe.title.localeCompare(b.recipe.title, "ru"));
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
    portions: Number(recipe.portions) || 2,
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
  const context = matchingContext(body);
  const owned = new Set(context.ingredients.map(normalizedTitle));
  const counts = new Map();
  for (const recipe of catalog) {
    if (!recipePassesFilters(recipe, { ...body, course: "все", excludeTitles: [] })) continue;
    const analysis = analyzeWithContext(recipe, context);
    if (analysis.requiredMissing?.length !== 1) continue;
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
  const generationBody = { ...body, equipment: [], portions: body.portions };
  const response = await featureWorker.fetch(requestWithJson(request, generationBody), env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data) return { response, data: null, recipes: [] };
  const recipes = Array.isArray(data.recipes) ? rankRecipes(data.recipes, body).map((item) => item.recipe) : [];
  return { response, data, recipes };
}

function resultResponse(recipes, body, { source = "deterministic-catalog", suggestions = [], extra = {} } = {}) {
  return json({
    ...extra,
    recipes,
    suggestions,
    hasMore: false,
    source,
    relaxation: null,
    originalFilters: {
      searchMode: body.searchMode,
      course: body.course,
      portions: body.portions,
      maxMinutes: body.maxMinutes,
      difficulty: body.difficulty || "",
    },
  });
}

function normalizedBody(body = {}) {
  const difficulty = typeof body.difficulty === "string" && body.difficulty.trim() ? body.difficulty.trim() : undefined;
  return {
    ...body,
    maxMinutes: Math.round(clampNumber(body.maxMinutes, 0, 0, 1440)),
    portions: Math.round(clampNumber(body.portions, 2, 1, 24)),
    priorityIngredients: Array.isArray(body.priorityIngredients) ? body.priorityIngredients.filter(Boolean) : [],
    difficulty,
    searchMode: body.searchMode === "plus-one" ? "plus-one" : "strict",
    course: ["все", "завтрак", "суп", "основное", "перекус", "салат", "закуска", "соус"].includes(body.course) ? body.course : "все",
    enforceEquipment: body.enforceEquipment === true,
  };
}

async function smartGenerate(request, env, ctx) {
  const incoming = await request.clone().json().catch(() => ({}));
  if (!Array.isArray(incoming.ingredients) || !incoming.ingredients.length) return featureWorker.fetch(request, env, ctx);
  const body = normalizedBody(incoming);
  const catalog = matchingCatalog(body.portions);
  const suggestions = ingredientUnlockSuggestions(catalog, body);
  const catalogRanked = rankRecipes(catalog, body).map(({ recipe }) => compactMatchedRecipe(recipe));

  if (catalogRanked.length && !incoming.aiIdeas) return resultResponse(catalogRanked, body, { suggestions });
  if (catalogRanked.length && incoming.aiIdeas) {
    const generated = await runAiIdeas(body, request, env, ctx);
    return resultResponse(mergeRecipes(catalogRanked, generated.recipes), body, { source: generated.recipes.length ? "deterministic-plus-ai" : "deterministic-catalog", suggestions, extra: generated.data || {} });
  }

  if (!incoming.aiIdeas) return resultResponse([], body, { suggestions, extra: { error: suggestions.length ? "Добавьте один из предложенных продуктов — появятся новые варианты" : "Для этого набора пока нет близкого рецепта" } });
  const generated = await runAiIdeas(body, request, env, ctx);
  if (generated.recipes.length) return resultResponse(generated.recipes.map(compactMatchedRecipe), body, { source: "workers-ai", suggestions, extra: generated.data || {} });
  if (!generated.data && !generated.response.ok) return generated.response;
  return resultResponse([], body, { suggestions, extra: { error: suggestions.length ? "Добавьте один из предложенных продуктов" : "Попробуйте другой набор продуктов" } });
}

async function matchingSuggestions(request) {
  const url = new URL(request.url);
  const body = normalizedBody({
    ingredients: url.searchParams.getAll("ingredient"),
    equipment: url.searchParams.getAll("equipment"),
    baseIngredients: url.searchParams.getAll("base"),
    portions: url.searchParams.get("portions") || 2,
    course: "все",
    searchMode: "strict",
  });
  if (!body.ingredients.length) return json({ suggestions: [] });
  return json({ suggestions: ingredientUnlockSuggestions(matchingCatalog(body.portions), body) }, 200, { "cache-control": "public, max-age=60, s-maxage=300" });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/generate" && request.method === "POST") return smartGenerate(request, env, ctx);
    if (url.pathname === "/api/matching-suggestions" && request.method === "GET") return matchingSuggestions(request);
    return featureWorker.fetch(request, env, ctx);
  },
};
