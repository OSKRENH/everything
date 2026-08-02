const EXACT_GROUPS = {
  tomato: ["помидор", "помидоры", "томат", "томаты", "свежие помидоры"],
  "tomato-canned": ["консервированные помидоры", "томаты в собственном соку", "рубленые томаты"],
  "tomato-paste": ["томатная паста"],
  onion: ["лук", "репчатый лук", "лук репчатый", "красный лук", "белый лук"],
  "green-onion": ["зелёный лук", "лук зелёный", "перо лука"],
  leek: ["лук-порей", "порей"],
  garlic: ["чеснок"],
  potato: ["картофель", "картошка"],
  carrot: ["морковь"],
  egg: ["яйцо", "яйца", "яичный желток", "желток", "яичный белок"],
  chicken: ["курица", "куриное мясо"],
  "chicken-thigh": ["куриное бедро", "бедро курицы", "куриные бедра"],
  "chicken-breast": ["куриная грудка", "грудка курицы", "куриное филе"],
  beef: ["говядина", "говяжье мясо"],
  pork: ["свинина", "свиное мясо"],
  lamb: ["баранина"],
  fish: ["рыба", "рыбное филе"],
  shrimp: ["креветка", "креветки"],
  rice: ["рис"],
  "rice-basmati": ["рис басмати", "басмати"],
  "rice-devzira": ["рис девзира", "девзира"],
  "rice-cooked": ["варёный рис", "готовый рис", "отварной рис"],
  pasta: ["макароны", "паста"],
  spaghetti: ["спагетти"],
  noodles: ["лапша", "яичная лапша", "рисовая лапша"],
  flour: ["мука", "пшеничная мука"],
  bread: ["хлеб", "белый хлеб", "батон"],
  flatbread: ["пита", "лаваш", "лепёшка", "тортилья"],
  milk: ["молоко", "коровье молоко"],
  cream: ["сливки"],
  yogurt: ["йогурт", "греческий йогурт"],
  sourcream: ["сметана"],
  butter: ["сливочное масло"],
  ghee: ["топлёное масло", "гхи"],
  "oil-vegetable": ["растительное масло", "подсолнечное масло", "нейтральное масло"],
  "oil-olive": ["оливковое масло", "масло оливковое"],
  cheese: ["сыр", "твёрдый сыр", "полутвёрдый сыр"],
  parmesan: ["пармезан", "пармиджано реджано", "грана падано"],
  pecorino: ["пекорино", "пекорино романо"],
  gruyere: ["грюйер", "сыр грюйер", "эмменталь", "комте"],
  mozzarella: ["моцарелла"],
  lemon: ["лимон", "лимонный сок", "сок лимона"],
  lime: ["лайм", "сок лайма", "лаймовый сок"],
  vinegar: ["уксус", "столовый уксус"],
  "vinegar-wine": ["винный уксус", "хересный уксус", "красный винный уксус"],
  "vinegar-rice": ["рисовый уксус"],
  soy: ["соевый соус", "светлый соевый соус", "тёмный соевый соус"],
  stock: ["бульон", "куриный бульон", "говяжий бульон", "овощной бульон"],
  chickpea: ["нут", "варёный нут"],
  lentil: ["чечевица", "красная чечевица", "зелёная чечевица"],
  mushroom: ["грибы", "шампиньоны", "вешенки"],
  pepper: ["сладкий перец", "болгарский перец"],
  chili: ["чили", "перец чили", "хлопья чили", "красный острый перец"],
  parsley: ["петрушка"],
  dill: ["укроп"],
  cilantro: ["кинза", "кориандр свежий"],
  basil: ["базилик", "свежий базилик"],
};

const PARENT = {
  "tomato-canned": "tomato",
  "chicken-thigh": "chicken",
  "chicken-breast": "chicken",
  "rice-basmati": "rice",
  "rice-devzira": "rice",
  "rice-cooked": "rice",
  spaghetti: "pasta",
  parmesan: "cheese",
  pecorino: "cheese",
  gruyere: "cheese",
  mozzarella: "cheese",
  ghee: "butter",
  "oil-olive": "oil",
  "oil-vegetable": "oil",
  "vinegar-wine": "vinegar",
  "vinegar-rice": "vinegar",
};

const SUBSTITUTIONS = {
  tomato: ["tomato-canned"],
  "tomato-canned": ["tomato"],
  spaghetti: ["pasta"],
  pasta: ["spaghetti", "noodles"],
  parmesan: ["pecorino", "gruyere", "cheese"],
  pecorino: ["parmesan", "cheese"],
  gruyere: ["cheese", "parmesan"],
  cream: ["sourcream", "yogurt"],
  yogurt: ["sourcream"],
  sourcream: ["yogurt"],
  butter: ["ghee"],
  ghee: ["butter"],
  "oil-olive": ["oil-vegetable"],
  lemon: ["lime", "vinegar-wine"],
  lime: ["lemon"],
  "vinegar-wine": ["vinegar-rice", "vinegar"],
  "vinegar-rice": ["vinegar-wine", "vinegar"],
  bread: ["flatbread"],
  flatbread: ["bread"],
  parsley: ["dill", "cilantro"],
  dill: ["parsley"],
  cilantro: ["parsley"],
};

const BASE_DEFAULTS = ["соль", "вода", "растительное масло", "оливковое масло", "чёрный перец"];
const OPTIONAL_FLAVORS = new Set([
  "петрушка", "укроп", "кинза", "тимьян", "орегано", "базилик", "паприка", "куркума", "зира", "кумин",
  "мускатный орех", "чили", "перец чили", "хлопья чили", "лавровый лист", "кунжут", "сахар",
]);
const SERVING_WORDS = /для подачи|при подаче|украш|гарнир|по желанию|опциональн|необязательн/i;
const EQUIPMENT_NAMES = {
  pan: "сковорода",
  pot: "кастрюля",
  oven: "духовка",
  blender: "блендер",
  microwave: "микроволновка",
  multicooker: "мультиварка",
};

const ALIAS_TO_ID = new Map();
for (const [id, aliases] of Object.entries(EXACT_GROUPS)) {
  for (const alias of aliases) ALIAS_TO_ID.set(normalizeIngredient(alias), id);
}

export function normalizeIngredient(value = "") {
  return String(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[«»“”"'()]/g, " ")
    .replace(/[^a-zа-я0-9\s-]/giu, " ")
    .replace(/\s+/g, " ")
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

export function canonicalIngredient(value = "") {
  const normalized = normalizeIngredient(value);
  if (ALIAS_TO_ID.has(normalized)) return ALIAS_TO_ID.get(normalized);
  for (const [alias, id] of ALIAS_TO_ID) {
    if (alias.length >= 5 && (normalized === alias || normalized.startsWith(`${alias} `) || normalized.endsWith(` ${alias}`))) return id;
  }
  return `raw:${textSignature(normalized) || normalized}`;
}

function ancestors(id) {
  const result = [];
  let current = id;
  while (PARENT[current] && !result.includes(PARENT[current])) {
    current = PARENT[current];
    result.push(current);
  }
  return result;
}

function readableIngredient(id, fallback = "") {
  return EXACT_GROUPS[id]?.[0] || fallback;
}

export function ingredientMatch(recipeIngredient, ownedIngredient) {
  const required = canonicalIngredient(recipeIngredient);
  const owned = canonicalIngredient(ownedIngredient);
  if (!required || !owned) return { type: "none" };
  if (required === owned) return { type: "exact", owned: ownedIngredient };
  if (ancestors(owned).includes(required)) return { type: "category", owned: ownedIngredient };
  if (ancestors(required).includes(owned)) return { type: "substitute", owned: ownedIngredient, replacement: readableIngredient(owned, ownedIngredient) };
  if ((SUBSTITUTIONS[required] || []).includes(owned)) return { type: "substitute", owned: ownedIngredient, replacement: readableIngredient(owned, ownedIngredient) };

  const left = textSignature(recipeIngredient);
  const right = textSignature(ownedIngredient);
  if (left && right && left === right) return { type: "exact", owned: ownedIngredient };
  return { type: "none" };
}

export function ingredientRole(item, recipe = {}, index = 0, baseIngredients = BASE_DEFAULTS) {
  if (item?.role === "required" || item?.role === "optional" || item?.role === "base") return item.role;
  const name = normalizeIngredient(item?.name);
  if (item?.pantry === true || baseIngredients.some((base) => ingredientMatch(name, base).type !== "none")) return "base";
  if (SERVING_WORDS.test(`${item?.note || ""} ${item?.name || ""}`)) return "optional";

  const title = normalizeIngredient(`${recipe?.title || ""} ${recipe?.subtitle || ""}`);
  const canonical = canonicalIngredient(name);
  const titleMentionsIngredient = EXACT_GROUPS[canonical]?.some((alias) => title.includes(normalizeIngredient(alias))) || title.includes(name);
  if (titleMentionsIngredient || index < 3) return "required";
  if (OPTIONAL_FLAVORS.has(name) || OPTIONAL_FLAVORS.has(readableIngredient(canonical))) return "optional";
  return "required";
}

function normalizeEquipment(value = "") {
  const normalized = normalizeIngredient(value);
  return EQUIPMENT_NAMES[normalized] || normalized;
}

export function analyzeRecipe(recipe, context = {}) {
  const ownedIngredients = Array.isArray(context.ingredients) ? context.ingredients.filter(Boolean) : [];
  const priorityIngredients = Array.isArray(context.priorityIngredients) ? context.priorityIngredients.filter(Boolean) : [];
  const baseIngredients = Array.isArray(context.baseIngredients) && context.baseIngredients.length ? context.baseIngredients : BASE_DEFAULTS;
  const equipment = (Array.isArray(context.equipment) ? context.equipment : []).map(normalizeEquipment);

  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item, index) => {
    const role = ingredientRole(item, recipe, index, baseIngredients);
    let best = { type: role === "base" ? "base" : "none" };
    for (const owned of ownedIngredients) {
      const match = ingredientMatch(item?.name, owned);
      const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
      if (rank[match.type] > rank[best.type || "none"]) best = match;
      if (best.type === "exact") break;
    }
    return { ...item, role, semanticId: canonicalIngredient(item?.name), match: best };
  });

  const requiredMissing = ingredients.filter((item) => item.role === "required" && item.match.type === "none");
  const optionalMissing = ingredients.filter((item) => item.role === "optional" && item.match.type === "none");
  const substitutions = ingredients.filter((item) => item.match.type === "substitute");
  const exactAvailable = ingredients.filter((item) => ["exact", "category", "base"].includes(item.match.type));
  const requiredEquipment = Array.isArray(recipe?.equipment) ? recipe.equipment : [];
  const missingEquipment = requiredEquipment.filter((required) => equipment.length && !equipment.includes(normalizeEquipment(required)));
  const priorityHits = priorityIngredients.filter((priority) => ingredients.some((item) => ["exact", "category"].includes(ingredientMatch(item.name, priority).type)));

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
  if (!requiredMissing.length && !missingEquipment.length) reasons.push("Все обязательные продукты и техника есть");
  if (priorityHits.length) reasons.push(`Использует в первую очередь: ${priorityHits.join(", ")}`);
  if (substitutions.length) reasons.push(...substitutions.slice(0, 2).map((item) => `${item.name} можно заменить на ${item.match.owned}`));
  if (requiredMissing.length === 1) reasons.push(`Не хватает только: ${requiredMissing[0].name}`);
  if (requiredMissing.length > 1) reasons.push(`Не хватает обязательных продуктов: ${requiredMissing.length}`);
  if (missingEquipment.length) reasons.push(`Нужна техника: ${missingEquipment.join(", ")}`);
  if (optionalMissing.length) reasons.push(`Без ${optionalMissing.slice(0, 2).map((item) => item.name).join(" и ")} можно обойтись`);

  return {
    recipe,
    ingredients,
    group,
    score,
    reasons,
    requiredMissing,
    optionalMissing,
    substitutions,
    exactAvailable,
    missingEquipment,
    priorityHits,
  };
}

export function enrichRecipeSemantics(recipe, context = {}) {
  const analysis = analyzeRecipe(recipe, context);
  return {
    ...recipe,
    ingredients: analysis.ingredients.map(({ match, ...item }) => ({ ...item, matchType: match.type, matchedOwned: match.owned || "" })),
    matching: {
      group: analysis.group,
      score: analysis.score,
      reasons: analysis.reasons,
      missingRequired: analysis.requiredMissing.map((item) => item.name),
      missingOptional: analysis.optionalMissing.map((item) => item.name),
      substitutions: analysis.substitutions.map((item) => ({ ingredient: item.name, owned: item.match.owned || "" })),
      missingEquipment: analysis.missingEquipment,
      priorityHits: analysis.priorityHits,
    },
  };
}

export const DEFAULT_BASE_INGREDIENTS = [...BASE_DEFAULTS];
