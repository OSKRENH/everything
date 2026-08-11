const MANUAL_EQUIPMENT = ["руки", "нож", "разделочная доска", "миска", "ложка", "вилка"];
const EQUIPMENT_NAMES = {
  pan: "сковорода",
  pot: "кастрюля",
  oven: "духовка",
  blender: "блендер",
  microwave: "микроволновка",
  multicooker: "мультиварка",
  сковорода: "сковорода",
  сковородка: "сковорода",
  сотейник: "сковорода",
  кастрюля: "кастрюля",
  казан: "кастрюля",
  блендер: "блендер",
  "погружной блендер": "блендер",
  духовка: "духовка",
  "духовой шкаф": "духовка",
  микроволновка: "микроволновка",
  "микроволновая печь": "микроволновка",
  мультиварка: "мультиварка",
};

export function normalizeIngredient(value = "") {
  return String(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[«»“”"'()]/g, " ")
    .replace(/[^a-zа-я0-9\s-]/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedCommonName(value = "") {
  const normalized = normalizeIngredient(value);
  if (/^масло(?:\s+(?:для\s+)?(?:жарки|обжарки|обжаривания))?$/.test(normalized)) return "растительное масло";
  return normalized
    .replace(/^(?:свежий|свежая|свежие|замороженный|замороженная|замороженные|охлажденный|охлажденная|очищенный|очищенная)\s+/u, "")
    .replace(/\s+(?:свежий|свежая|свежие|замороженный|замороженная|замороженные|охлажденный|охлажденная|очищенный|очищенная)$/u, "")
    .trim();
}

function stemWord(value = "") {
  const word = normalizeIngredient(value).replace(/[^а-яa-z0-9]/gu, "");
  if (word.length <= 4) return word;
  return word.replace(/(?:иями|ями|ами|его|ого|ему|ому|ыми|ими|ой|ый|ий|ая|яя|ое|ее|ые|ие|ую|юю|ов|ев|ам|ям|ах|ях|ом|ем|у|ю|а|я|ы|и|е|о)$/u, "");
}

function textSignature(value = "") {
  return normalizeIngredient(value).split(/[\s-]+/).map(stemWord).filter((word) => word.length >= 3).join(" ");
}

export function canonicalIngredient(value = "", semantics = {}) {
  const normalized = normalizedCommonName(value);
  if (!normalized) return "";
  const aliases = semantics.aliases || {};
  if (aliases[normalized]) return aliases[normalized];
  for (const entry of semantics.semanticAliases || []) {
    const alias = entry?.[0];
    if (!alias || alias.length < 5) continue;
    if (normalized === alias || normalized.startsWith(`${alias} `) || normalized.endsWith(` ${alias}`)) return entry[1];
  }
  return `raw:${textSignature(normalized) || normalized}`;
}

function relationType(required, owned, semantics = {}) {
  if (!required || !owned) return "none";
  if (required === owned) return "exact";
  return semantics.relations?.[required]?.[owned] || "none";
}

export function ingredientMatch(recipeIngredient, ownedIngredient, semantics = {}) {
  const required = canonicalIngredient(recipeIngredient, semantics);
  const owned = canonicalIngredient(ownedIngredient, semantics);
  const type = relationType(required, owned, semantics);
  if (type === "none") return { type };
  if (type === "substitute") return { type, owned: ownedIngredient, replacement: semantics.readable?.[owned] || ownedIngredient };
  return { type, owned: ownedIngredient };
}

function matchSemanticIds(ids, ownedIngredient, semantics = {}) {
  const owned = canonicalIngredient(ownedIngredient, semantics);
  const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
  let best = { type: "none" };
  for (const required of ids || []) {
    const type = relationType(required, owned, semantics);
    if (rank[type] <= rank[best.type]) continue;
    best = type === "substitute"
      ? { type, owned: ownedIngredient, replacement: semantics.readable?.[owned] || ownedIngredient }
      : { type, owned: ownedIngredient };
    if (type === "exact") break;
  }
  return best;
}

export function ingredientMatchAny(item, ownedIngredient, semantics = {}) {
  if (Array.isArray(item?.semanticIds) && item.semanticIds.length) return matchSemanticIds(item.semanticIds, ownedIngredient, semantics);
  const candidates = [item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])].filter(Boolean);
  const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
  let best = { type: "none" };
  for (const candidate of candidates) {
    const match = ingredientMatch(candidate, ownedIngredient, semantics);
    if (rank[match.type] > rank[best.type]) best = match;
    if (best.type === "exact") break;
  }
  return best;
}

function selectedBaseMatch(item, baseIngredients, semantics) {
  const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
  let best = { type: "none" };
  for (const base of baseIngredients) {
    const match = ingredientMatchAny(item, base, semantics);
    if (rank[match.type] > rank[best.type]) best = match;
  }
  return best;
}

export function ingredientRole(item, baseIngredients = [], semantics = {}) {
  if (item?.role === "required" || item?.role === "optional" || item?.role === "base") return item.role;
  const baseMatch = selectedBaseMatch(item, baseIngredients, semantics);
  if (["exact", "category"].includes(baseMatch.type)) return "base";
  return item?.roleNoBase || "required";
}

function normalizeEquipment(value = "") {
  const normalized = normalizeIngredient(value);
  return EQUIPMENT_NAMES[normalized] || normalized;
}

export function analyzeRecipe(recipe, context = {}, semantics = {}) {
  const defaultBase = Array.isArray(semantics.defaultBase) ? semantics.defaultBase : ["соль", "вода", "растительное масло", "сахар"];
  const baseIngredients = Array.isArray(context.baseIngredients) && context.baseIngredients.length ? context.baseIngredients : defaultBase;
  const ownedIngredients = [...new Set([...(Array.isArray(context.ingredients) ? context.ingredients.filter(Boolean) : []), ...baseIngredients])];
  const priorityIngredients = Array.isArray(context.priorityIngredients) ? context.priorityIngredients.filter(Boolean) : [];
  const selectedEquipment = (Array.isArray(context.equipment) ? context.equipment : []).map(normalizeEquipment);
  const enforceEquipment = context.enforceEquipment === true;
  const equipment = enforceEquipment ? [...new Set([...MANUAL_EQUIPMENT.map(normalizeEquipment), ...selectedEquipment])] : [];

  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item) => {
    const role = ingredientRole(item, baseIngredients, semantics);
    let best = { type: role === "base" ? "base" : "none" };
    for (const owned of ownedIngredients) {
      const match = ingredientMatchAny(item, owned, semantics);
      const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
      if (rank[match.type] > rank[best.type || "none"]) best = match;
      if (best.type === "exact") break;
    }
    return { ...item, role, semanticId: item?.semanticIds?.[0] || canonicalIngredient(item?.name, semantics), match: best };
  });

  const requiredMissing = ingredients.filter((item) => item.role === "required" && item.match.type === "none");
  const optionalMissing = ingredients.filter((item) => item.role === "optional" && item.match.type === "none");
  const substitutions = ingredients.filter((item) => item.match.type === "substitute");
  const exactAvailable = ingredients.filter((item) => ["exact", "category", "base"].includes(item.match.type));
  const requiredEquipment = Array.isArray(recipe?.equipment) ? recipe.equipment : [];
  const missingEquipment = enforceEquipment
    ? requiredEquipment.filter((required) => !equipment.includes(normalizeEquipment(required)))
    : [];
  const priorityHits = priorityIngredients.filter((priority) => ingredients.some((item) => ["exact", "category"].includes(ingredientMatchAny(item, priority, semantics).type)));

  let group = "ready";
  if (missingEquipment.length || requiredMissing.length > 1) group = "more";
  else if (requiredMissing.length === 1) group = "one";
  else if (substitutions.length || optionalMissing.length) group = "substitute";

  const score = (group === "ready" ? 1200 : group === "substitute" ? 950 : group === "one" ? 650 : 0)
    + priorityHits.length * 80
    + exactAvailable.filter((item) => item.role === "required").length * 14
    - requiredMissing.length * 180
    - missingEquipment.length * 220
    - optionalMissing.length * 6
    - substitutions.length * 12;

  const reasons = [];
  if (!requiredMissing.length) reasons.push(substitutions.length ? "Все основные продукты есть; часть можно заменить" : "Все обязательные продукты есть");
  if (priorityHits.length) reasons.push(`Использует в первую очередь: ${priorityHits.join(", ")}`);
  if (substitutions.length) reasons.push(...substitutions.slice(0, 2).map((item) => `${item.name} можно заменить на ${item.match.owned}`));
  if (requiredMissing.length === 1) reasons.push(`Не хватает только: ${requiredMissing[0].name}`);
  if (requiredMissing.length > 1) reasons.push(`Не хватает обязательных продуктов: ${requiredMissing.length}`);
  if (missingEquipment.length) reasons.push(`Нужна техника: ${missingEquipment.join(", ")}`);
  if (optionalMissing.length) reasons.push(`Без ${optionalMissing.slice(0, 2).map((item) => item.name).join(" и ")} можно обойтись`);

  return { recipe, ingredients, group, score, reasons, requiredMissing, optionalMissing, substitutions, exactAvailable, missingEquipment, priorityHits };
}
