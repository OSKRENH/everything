import { analyzeRecipe, normalizeIngredient } from "../src/ingredient-semantics-v3.js";
import { applyMatchingUserContext, matchingPayloadFromContext } from "../src/matching-user-context.js";
import { loadRuntimeRecipes } from "./catalog-runtime-store.js";
import { recipeImageSet } from "./recipe-images.js";

const MATCHING_PAGE_SIZE = 20;
const MATCHING_CANDIDATE_LIMIT = 40;
const RUNTIME_BASE_PORTIONS = 2;
const FAST_EQUIVALENT_TERMS = new Map([
  ["яйцо", "яйца"],
  ["яйца", "яйца"],
]);
let genericSuggestionCache = null;
let featureWorkerModulePromise = null;

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
}

async function featureWorkerFetch(request, env, ctx) {
  featureWorkerModulePromise ||= import("./entry.js");
  const { default: featureWorker } = await featureWorkerModulePromise;
  return featureWorker.fetch(request, env, ctx);
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

function cleanList(value, { limit = 24, maxLength = 120 } = {}) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean))].slice(0, limit);
}

function matchingContext(body = {}) {
  const user = matchingPayloadFromContext(body);
  return {
    ingredients: cleanList(body.ingredients),
    priorityIngredients: cleanList(body.priorityIngredients),
    equipment: body.enforceEquipment === true ? cleanList(body.equipment, { limit: 24, maxLength: 80 }) : [],
    enforceEquipment: body.enforceEquipment === true,
    baseIngredients: Array.isArray(body.baseIngredients) ? cleanList(body.baseIngredients, { limit: 24, maxLength: 80 }) : undefined,
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

function scaleAmount(amount, portions) {
  const text = String(amount || "").trim();
  if (!text || /по вкусу/i.test(text) || portions === RUNTIME_BASE_PORTIONS) return text;
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/u);
  if (!match) return text;
  const factor = portions / RUNTIME_BASE_PORTIONS;
  const unit = String(match[2] || "").trim();
  const raw = Number(match[1].replace(",", ".")) * factor;
  let value = raw;
  if (/^(г|мл)$/iu.test(unit)) value = Math.max(1, Math.round(raw / 5) * 5);
  else if (/^(?:шт\.?|зубч\.?|гол\.?)$/iu.test(unit)) value = Math.max(1, Math.ceil(raw));
  else value = Math.max(0.25, Math.round(raw * 4) / 4);
  const displayed = Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  return `${displayed}${unit ? ` ${unit}` : ""}`;
}

function matchingRecipeFromRuntime(recipe, portions) {
  const factor = portions / RUNTIME_BASE_PORTIONS;
  const photo = recipeImageSet(recipe);
  return {
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
    portions,
    equipment: Array.isArray(recipe.equipment) ? recipe.equipment.map(String) : [],
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item) => ({
      name: String(item?.name || ""),
      amount: scaleAmount(item?.amount, portions),
      aliases: Array.isArray(item?.aliases) ? item.aliases.map(String).filter(Boolean) : [],
      pantry: item?.pantry === true,
      ...(item?.role ? { role: String(item.role) } : {}),
    })),
    nutrition: { calories: Math.max(0, Math.round((Number(recipe.nutrition?.calories) || 0) * factor)) },
    source: recipe.source || {},
    missing: [],
    uses: [],
    why: recipe.why || "Проверенный рецепт Кутно",
    hasPhoto: Boolean(photo),
    photo,
  };
}

async function matchingCatalog(request, env, body, portions = 2) {
  const runtime = await loadRuntimeRecipes(request, env);
  const candidates = matchingCandidatePool(runtime, body).map((recipe) => matchingRecipeFromRuntime(recipe, portions));
  return { runtime, candidates };
}

function fastNormalizedTerm(value = "") {
  const term = normalizeIngredient(value);
  return FAST_EQUIVALENT_TERMS.get(term) || term;
}

function fastPrefixes(value = "") {
  return String(value).split(/[\s-]+/).filter((word) => word.length >= 4).map((word) => word.slice(0, 4));
}

function fastRecipeIndex(recipe) {
  const terms = Array.isArray(recipe?.matchTerms) && recipe.matchTerms.length
    ? recipe.matchTerms
    : (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
      .map((item) => String(item?.name || "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim())
      .filter(Boolean);
  const prefixes = Array.isArray(recipe?.matchPrefixes) && recipe.matchPrefixes.length
    ? recipe.matchPrefixes
    : [...new Set(terms.flatMap((term) => fastPrefixes(term)))];
  return { terms, prefixes };
}

function fastRecipeScore(recipe, ownedTerm) {
  const index = fastRecipeIndex(recipe);
  if (index.terms.includes(ownedTerm.term)) return 6;
  for (const term of index.terms) {
    if (term.length >= 4 && ownedTerm.term.length >= 4 && (term.includes(ownedTerm.term) || ownedTerm.term.includes(term))) return 4;
  }
  return ownedTerm.prefixes.some((prefix) => index.prefixes.includes(prefix)) ? 1 : 0;
}

function matchingCandidatePool(catalog, body, limit = MATCHING_CANDIDATE_LIMIT) {
  const owned = cleanList(body.ingredients).map((item) => fastNormalizedTerm(item)).filter(Boolean).map((term) => ({ term, prefixes: fastPrefixes(term) }));
  if (!owned.length) return [];
  return catalog
    .map((recipe, index) => {
      if (!recipePassesFilters(recipe, body)) return { recipe, index, score: 0 };
      let score = 0;
      for (const ownedTerm of owned) score += fastRecipeScore(recipe, ownedTerm);
      return { recipe, index, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.recipe);
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
  return (analysis.requiredMissing?.length || 0) <= 3;
}

function analyzeWithContext(recipe, context) {
  return applyMatchingUserContext(recipe, analyzeRecipe(recipe, context), context);
}

function enrichedWithContext(recipe, context, analysis = analyzeWithContext(recipe, context)) {
  const userOwned = new Set((context.ingredients || []).map(normalizedTitle));
  const uses = [...new Set(
    analysis.exactAvailable
      .filter((item) => item.role !== "base" && item.match?.owned && userOwned.has(normalizedTitle(item.match.owned)))
      .map((item) => item.match.owned),
  )];
  const exactRequired = analysis.exactAvailable.filter((item) => item.role === "required").length;
  return {
    ...recipe,
    ingredients: (analysis.ingredients || []).map(({ match, ...item }) => ({
      ...item,
      matchType: match?.type || "none",
      matchedOwned: match?.owned || "",
    })),
    uses,
    usedCount: uses.length,
    coverage: exactRequired / Math.max(1, analysis.ingredients.filter((item) => item.role === "required").length),
    matching: {
      group: analysis.group,
      score: analysis.score,
      reasons: analysis.reasons,
      missingRequired: analysis.requiredMissing.map((item) => item.name),
      missingOptional: analysis.optionalMissing.map((item) => item.name),
      substitutions: analysis.substitutions.map((item) => ({ ingredient: item.name, owned: item.match?.owned || "" })),
      missingEquipment: analysis.missingEquipment,
      priorityHits: analysis.priorityHits || [],
      quantityShortages: (analysis.quantityShortages || []).map((item) => ({ name: item.name, have: `${item.have.quantity} ${item.have.unit}`.trim(), need: item.need })),
      preferencePenalty: analysis.preferencePenalty || 0,
    },
  };
}

function rankingScore(item) {
  return item.usedCount * 10 - item.missingCount * 7 - item.optionalMissing - item.substitutions * 2;
}

function suggestionList(counts, limit = 6) {
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")).slice(0, limit);
}

function rankAndSuggestRecipes(catalog, body) {
  const context = matchingContext(body);
  const owned = new Set(context.ingredients.map(normalizedTitle));
  const counts = new Map();
  const ranked = [];

  for (const recipe of catalog) {
    const analysis = analyzeWithContext(recipe, context);
    if (analysis.requiredMissing?.length === 1) {
      const name = String(analysis.requiredMissing[0]?.name || "").trim();
      const key = normalizedTitle(name);
      if (name && key && !owned.has(key)) {
        const current = counts.get(key) || { name, count: 0 };
        current.count += 1;
        if (name.length < current.name.length) current.name = name;
        counts.set(key, current);
      }
    }

    const enriched = enrichedWithContext(recipe, context, analysis);
    const exactRequired = analysis.exactAvailable.filter((item) => item.role === "required").length;
    if (!groupAllowed(analysis) || enriched.usedCount < 1 || (context.enforceEquipment && analysis.missingEquipment.length)) continue;
    ranked.push({
      recipe: enriched,
      analysis,
      missingCount: analysis.requiredMissing.length,
      usedCount: enriched.usedCount,
      exactRequired,
      substitutions: analysis.substitutions.length,
      optionalMissing: analysis.optionalMissing.length,
    });
  }

  ranked.sort((a, b) => rankingScore(b) - rankingScore(a)
    || a.missingCount - b.missingCount
    || b.usedCount - a.usedCount
    || b.exactRequired - a.exactRequired
    || a.substitutions - b.substitutions
    || a.optionalMissing - b.optionalMissing
    || Number(a.recipe.minutes) - Number(b.recipe.minutes)
    || a.recipe.title.localeCompare(b.recipe.title, "ru"));

  return { ranked, suggestions: suggestionList(counts) };
}

function rankRecipes(catalog, body) {
  return rankAndSuggestRecipes(catalog, body).ranked;
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
    ingredients: (recipe.ingredients || []).map((item) => ({ name: item.name, amount: item.amount || "", aliases: item.aliases || [], pantry: item.pantry === true, ...(item.role ? { role: item.role } : {}) })),
    nutrition: { calories: Number(recipe.nutrition?.calories) || 0 },
    source: recipe.source,
    matching: recipe.matching,
    missing: missingRequired.length ? missingRequired : Array.isArray(recipe.missing) ? recipe.missing : [],
    uses: Array.isArray(recipe.uses) ? recipe.uses : [],
    usedCount: Number(recipe.usedCount) || 0,
    coverage: Number(recipe.coverage) || 0,
    why: recipe.why,
    hasPhoto: recipe.hasPhoto === true,
    photo: recipe.photo || null,
  };
}

function genericSuggestionBase(catalog) {
  if (genericSuggestionCache) return genericSuggestionCache;
  const counts = new Map();
  for (const recipe of catalog) {
    for (const item of recipe.ingredients || []) {
      if (item?.pantry === true || item?.role === "base") continue;
      const name = String(item?.name || "").trim();
      const key = normalizedTitle(name);
      if (!name || !key) continue;
      const current = counts.get(key) || { name, count: 0, key };
      current.count += 1;
      if (name.length < current.name.length) current.name = name;
      counts.set(key, current);
    }
  }
  genericSuggestionCache = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")).slice(0, 24);
  return genericSuggestionCache;
}

function genericSuggestions(catalog, body, limit = 6) {
  const owned = new Set(cleanList(body.ingredients).map(normalizedTitle));
  return genericSuggestionBase(catalog).filter((item) => !owned.has(item.key)).slice(0, limit).map(({ name, count }) => ({ name, count }));
}

async function runAiIdeas(body, request, env, ctx) {
  const generationBody = { ...body, equipment: body.enforceEquipment ? body.equipment : [], portions: body.portions };
  const response = await featureWorkerFetch(requestWithJson(request, generationBody), env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data) return { response, data: null, recipes: [] };
  const recipes = Array.isArray(data.recipes) ? rankRecipes(data.recipes, body).map((item) => compactMatchedRecipe(item.recipe)) : [];
  return { response, data, recipes };
}

function resultResponse(recipes, body, { source = "deterministic-catalog", suggestions = [], extra = {}, hasMore = false } = {}) {
  return json({
    ...extra,
    recipes,
    suggestions,
    hasMore,
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

function pagedResultResponse(recipes, body, options = {}) {
  const offset = Math.max(0, Number(body.offset) || 0);
  const page = recipes.slice(offset, offset + MATCHING_PAGE_SIZE);
  return resultResponse(page, body, {
    ...options,
    extra: { ...(options.extra || {}), total: recipes.length, offset },
    hasMore: offset + page.length < recipes.length,
  });
}

function normalizedBody(body = {}) {
  const difficulty = typeof body.difficulty === "string" && body.difficulty.trim() ? body.difficulty.trim().slice(0, 40) : undefined;
  return {
    ...body,
    ingredients: cleanList(body.ingredients),
    equipment: cleanList(body.equipment, { limit: 24, maxLength: 80 }),
    baseIngredients: Array.isArray(body.baseIngredients) ? cleanList(body.baseIngredients, { limit: 24, maxLength: 80 }) : undefined,
    excludeTitles: cleanList(body.excludeTitles, { limit: 48, maxLength: 120 }),
    maxMinutes: Math.round(clampNumber(body.maxMinutes, 0, 0, 1440)),
    portions: Math.round(clampNumber(body.portions, 2, 1, 24)),
    offset: Math.floor(clampNumber(body.offset, 0, 0, 10000)),
    priorityIngredients: cleanList(body.priorityIngredients),
    difficulty,
    searchMode: body.searchMode === "plus-one" ? "plus-one" : "strict",
    course: ["все", "завтрак", "суп", "основное", "перекус", "салат", "закуска", "соус"].includes(body.course) ? body.course : "все",
    enforceEquipment: body.enforceEquipment === true,
  };
}

function invalidIncomingBody(body = {}) {
  if (!Array.isArray(body.ingredients)) return "Передайте продукты списком";
  if (body.ingredients.length > 64) return "Слишком много продуктов в одном запросе";
  if (body.ingredients.some((item) => typeof item !== "string")) return "Названия продуктов должны быть строками";
  if (body.ingredients.some((item) => item.length > 256 || /[<>]/.test(item))) return "Некорректное название продукта";
  if (body.portions !== undefined) {
    const portions = Number(body.portions);
    if (!Number.isFinite(portions) || portions < 1 || portions > 24) return "Количество порций должно быть от 1 до 24";
  }
  if (body.offset !== undefined) {
    const offset = Number(body.offset);
    if (!Number.isFinite(offset) || offset < 0 || offset > 10000) return "Некорректное смещение выдачи";
  }
  if (body.course !== undefined && (typeof body.course !== "string" || body.course.length > 80 || /[<>]/.test(body.course))) return "Некорректный тип блюда";
  return "";
}

async function smartGenerate(request, env, ctx) {
  const incoming = await request.clone().json().catch(() => ({}));
  const invalid = invalidIncomingBody(incoming);
  if (invalid) return json({ error: invalid }, 400);
  const body = normalizedBody(incoming);
  if (!body.ingredients.length) return json({ error: "Добавьте хотя бы один продукт" }, 400);
  const { runtime, candidates } = await matchingCatalog(request, env, body, body.portions);
  const analyzed = rankAndSuggestRecipes(candidates, body);
  const catalogRanked = analyzed.ranked.map(({ recipe }) => compactMatchedRecipe(recipe));
  const suggestions = analyzed.suggestions.length ? analyzed.suggestions : genericSuggestions(runtime, body);

  if (catalogRanked.length && !incoming.aiIdeas) return pagedResultResponse(catalogRanked, body, { suggestions });
  if (catalogRanked.length && incoming.aiIdeas) {
    const generated = await runAiIdeas(body, request, env, ctx);
    const combined = mergeRecipes(catalogRanked, generated.recipes);
    return pagedResultResponse(combined, body, { source: generated.recipes.length ? "deterministic-plus-ai" : "deterministic-catalog", suggestions, extra: generated.data || {} });
  }

  if (!incoming.aiIdeas) return pagedResultResponse([], body, { suggestions, extra: { error: suggestions.length ? "Добавьте один из предложенных продуктов — появятся новые варианты" : "Для этого набора пока нет близкого рецепта" } });
  const generated = await runAiIdeas(body, request, env, ctx);
  if (generated.recipes.length) return pagedResultResponse(generated.recipes, body, { source: "workers-ai", suggestions, extra: generated.data || {} });
  if (!generated.data && !generated.response.ok) return generated.response;
  return pagedResultResponse([], body, { suggestions, extra: { error: suggestions.length ? "Добавьте один из предложенных продуктов" : "Попробуйте другой набор продуктов" } });
}

async function matchingSuggestions(request, env) {
  const url = new URL(request.url);
  const body = normalizedBody({
    ingredients: url.searchParams.getAll("ingredient"),
    equipment: url.searchParams.getAll("equipment"),
    baseIngredients: url.searchParams.getAll("base"),
    portions: url.searchParams.get("portions") || 2,
    enforceEquipment: url.searchParams.get("enforceEquipment") === "true",
    course: "все",
    searchMode: "strict",
  });
  if (!body.ingredients.length) return json({ suggestions: [] });
  const { runtime, candidates } = await matchingCatalog(request, env, body, body.portions);
  const analyzed = rankAndSuggestRecipes(candidates, body);
  return json({ suggestions: analyzed.suggestions.length ? analyzed.suggestions : genericSuggestions(runtime, body) }, 200, { "cache-control": "public, max-age=60, s-maxage=300" });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/generate" && request.method === "POST") return smartGenerate(request, env, ctx);
    if (url.pathname === "/api/matching-suggestions" && request.method === "GET") return matchingSuggestions(request, env);
    return featureWorkerFetch(request, env, ctx);
  },
};