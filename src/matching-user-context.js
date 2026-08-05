import { ingredientMatch, normalizeIngredient } from "./ingredient-semantics-v3.js";

export const MATCHING_PANTRY_KEY = "kutno-pantry-details-v1";
export const MATCHING_FEEDBACK_KEY = "kutno-recipe-feedback-v1";
const FEEDBACK_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;

function cleanText(value = "", maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeUnit(value = "") {
  const unit = normalizeIngredient(value).replace(/\s+/g, " ");
  if (/^(кг|килограмм)/.test(unit)) return { unit: "кг", family: "mass", factor: 1000 };
  if (/^(г|гр|грамм)/.test(unit)) return { unit: "г", family: "mass", factor: 1 };
  if (/^(л|литр)/.test(unit)) return { unit: "л", family: "volume", factor: 1000 };
  if (/^(мл|миллилитр)/.test(unit)) return { unit: "мл", family: "volume", factor: 1 };
  if (/^ст(?:олов)?\s*л/.test(unit)) return { unit: "ст. л.", family: "volume", factor: 15 };
  if (/^ч(?:айн)?\s*л/.test(unit)) return { unit: "ч. л.", family: "volume", factor: 5 };
  if (/^(шт|штук|яйц|зубч|голов|ломтик|кусок)/.test(unit)) return { unit: "шт.", family: "count", factor: 1 };
  if (/^(уп|упаков|банк)/.test(unit)) return { unit, family: "package", factor: 1 };
  return null;
}

function numericText(value = "") {
  return String(value)
    .replace(/½/g, "0.5")
    .replace(/¼/g, "0.25")
    .replace(/¾/g, "0.75")
    .replace(/⅓/g, "0.333")
    .replace(/⅔/g, "0.667")
    .replace(/,/g, ".")
    .trim();
}

export function parseMatchingAmount(value = "") {
  const text = numericText(value).toLowerCase();
  if (!text || /по вкусу|сколько понадобится|щепот/.test(text)) return null;
  const mixed = text.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  const fraction = text.match(/(?<!\d)(\d+)\s*\/\s*(\d+)/);
  const decimal = text.match(/\d+(?:\.\d+)?/);
  let amount = null;
  let amountText = "";
  if (mixed) {
    amount = Number(mixed[1]) + Number(mixed[2]) / Math.max(1, Number(mixed[3]));
    amountText = mixed[0];
  } else if (fraction) {
    amount = Number(fraction[1]) / Math.max(1, Number(fraction[2]));
    amountText = fraction[0];
  } else if (decimal) {
    amount = Number(decimal[0]);
    amountText = decimal[0];
  }
  if (!Number.isFinite(amount)) return null;
  const unit = normalizeUnit(text.replace(amountText, "").trim());
  if (!unit) return null;
  return { value: amount * unit.factor, family: unit.family, unit: unit.unit };
}

export function sanitizeMatchingPantry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 120).flatMap(([key, item]) => {
    const name = cleanText(item?.name || key, 120);
    const normalized = normalizeIngredient(name);
    if (!normalized) return [];
    return [[normalized, {
      name,
      quantity: cleanNumber(item?.quantity),
      unit: cleanText(item?.unit, 20),
      useBy: /^\d{4}-\d{2}-\d{2}$/.test(String(item?.useBy || "")) ? String(item.useBy) : "",
      opened: Boolean(item?.opened),
      updatedAt: Math.max(0, Number(item?.updatedAt) || 0),
    }]];
  }));
}

export function sanitizeMatchingFeedback(value) {
  return (Array.isArray(value) ? value : []).slice(0, 120).flatMap((item) => {
    const reason = ["dislike-ingredient", "too-long", "too-hard", "not-today", "more-like-this"].includes(item?.reason)
      ? item.reason
      : "";
    if (!reason) return [];
    return [{
      recipeId: cleanText(item?.recipeId, 120),
      title: cleanText(item?.title, 180),
      reason,
      ingredient: cleanText(item?.ingredient, 120),
      minutes: Math.max(0, Number(item?.minutes) || 0),
      difficulty: cleanText(item?.difficulty, 40),
      cuisine: cleanText(item?.cuisine, 80),
      course: cleanText(item?.course, 80),
      protein: cleanText(item?.protein, 80),
      ingredients: (Array.isArray(item?.ingredients) ? item.ingredients : []).map((entry) => cleanText(entry, 120)).filter(Boolean).slice(0, 20),
      at: Math.max(0, Number(item?.at) || Date.now()),
      updatedAt: Math.max(0, Number(item?.updatedAt) || Number(item?.at) || Date.now()),
    }];
  });
}

function safeRead(storage, key, fallback) {
  try {
    return JSON.parse(storage?.getItem?.(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function browserMatchingUserContext(storage = globalThis.localStorage) {
  return {
    pantry: sanitizeMatchingPantry(safeRead(storage, MATCHING_PANTRY_KEY, {})),
    feedback: sanitizeMatchingFeedback(safeRead(storage, MATCHING_FEEDBACK_KEY, [])),
  };
}

function recipeIngredientMatches(recipeIngredient, pantryName) {
  const candidates = [recipeIngredient?.name, ...(Array.isArray(recipeIngredient?.aliases) ? recipeIngredient.aliases : [])].filter(Boolean);
  return candidates.some((candidate) => ["exact", "category"].includes(ingredientMatch(candidate, pantryName).type));
}

function pantryComparable(item) {
  if (!item || item.quantity == null || !item.unit) return null;
  const unit = normalizeUnit(item.unit);
  if (!unit) return null;
  return { value: Number(item.quantity) * unit.factor, family: unit.family };
}

function matchingPantryItem(ingredient, pantry) {
  return Object.values(pantry).find((item) => recipeIngredientMatches(ingredient, item.name)) || null;
}

export function quantityAssessmentForAnalysis(analysis, pantryValue) {
  const pantry = sanitizeMatchingPantry(pantryValue);
  const low = [];
  const enough = [];
  for (const ingredient of analysis?.ingredients || []) {
    if (ingredient.role !== "required" || !["exact", "category", "base"].includes(ingredient.match?.type)) continue;
    const pantryItem = matchingPantryItem(ingredient, pantry);
    if (!pantryItem) continue;
    const need = parseMatchingAmount(ingredient.amount);
    const have = pantryComparable(pantryItem);
    if (!need || !have || need.family !== have.family) continue;
    const entry = { name: ingredient.name, ingredient, have: pantryItem, need: ingredient.amount, needValue: need.value, haveValue: have.value };
    if (have.value + 0.001 < need.value) low.push(entry);
    else enough.push(entry);
  }
  return { low, enough };
}

function normalizedRecipeTitle(recipe) {
  return normalizeIngredient(recipe?.title || "");
}

function feedbackIngredientMatch(recipe, ingredient) {
  return (recipe?.ingredients || []).some((item) => ingredientMatch(item?.name, ingredient).type !== "none");
}

function sharedFeedbackIngredients(recipe, feedback) {
  const target = feedback.ingredients || [];
  return target.filter((name) => feedbackIngredientMatch(recipe, name)).length;
}

export function preferencePenaltyForRecipe(recipe, feedbackValue, now = Date.now()) {
  const feedback = sanitizeMatchingFeedback(feedbackValue).filter((item) => now - item.at <= FEEDBACK_WINDOW_MS);
  let penalty = 0;
  for (const item of feedback) {
    if (item.reason === "dislike-ingredient" && item.ingredient && feedbackIngredientMatch(recipe, item.ingredient)) penalty += 170;
    if (item.reason === "too-long" && Number(recipe?.minutes) >= Math.max(20, item.minutes || 30)) penalty += 35;
    if (item.reason === "too-hard" && /слож|обыч/.test(String(recipe?.difficulty || "").toLowerCase())) penalty += 30;
    if (item.reason === "not-today" && normalizedRecipeTitle(recipe) === normalizeIngredient(item.title) && now - item.at < 7 * 86_400_000) penalty += 110;
    if (item.reason === "more-like-this") {
      if (normalizedRecipeTitle(recipe) === normalizeIngredient(item.title)) penalty -= 90;
      if (item.cuisine && recipe?.cuisine === item.cuisine) penalty -= 22;
      if (item.course && recipe?.course === item.course) penalty -= 16;
      if (item.protein && recipe?.protein === item.protein) penalty -= 10;
      penalty -= Math.min(36, sharedFeedbackIngredients(recipe, item) * 12);
    }
  }
  return penalty;
}

function groupBase(group) {
  return { ready: 1200, substitute: 950, one: 650, more: 0 }[group] ?? 0;
}

export function applyMatchingUserContext(recipe, baseAnalysis, context = {}) {
  const assessment = quantityAssessmentForAnalysis(baseAnalysis, context.pantry || {});
  const shortageMissing = assessment.low.map((item) => ({
    ...item.ingredient,
    name: item.name,
    quantityShortage: true,
    availableAmount: item.have,
    requiredAmount: item.need,
  }));
  const missingByName = new Map((baseAnalysis.requiredMissing || []).map((item) => [normalizeIngredient(item.name), item]));
  shortageMissing.forEach((item) => missingByName.set(normalizeIngredient(item.name), item));
  const requiredMissing = [...missingByName.values()];
  let group = "ready";
  if ((baseAnalysis.missingEquipment || []).length || requiredMissing.length > 1) group = "more";
  else if (requiredMissing.length === 1) group = "one";
  else if ((baseAnalysis.substitutions || []).length || (baseAnalysis.optionalMissing || []).length) group = "substitute";

  const preferencePenalty = preferencePenaltyForRecipe(recipe, context.feedback || []);
  const reasons = (baseAnalysis.reasons || []).filter((reason) => !assessment.low.length || !/все обязательные продукты/i.test(reason));
  if (assessment.low.length) {
    reasons.unshift(...assessment.low.slice(0, 2).map((item) => `Не хватает количества: ${item.name} — есть ${item.have.quantity} ${item.have.unit}, нужно ${item.need}`));
  }
  const score = Number(baseAnalysis.score || 0)
    - groupBase(baseAnalysis.group)
    + groupBase(group)
    - assessment.low.length * 55
    - preferencePenalty;

  return {
    ...baseAnalysis,
    group,
    score,
    reasons,
    requiredMissing,
    quantityShortages: assessment.low,
    quantityEnough: assessment.enough,
    preferencePenalty,
  };
}

export function matchingPayloadFromContext(context = {}) {
  return {
    pantry: sanitizeMatchingPantry(context.pantry || {}),
    feedback: sanitizeMatchingFeedback(context.feedback || []),
  };
}
