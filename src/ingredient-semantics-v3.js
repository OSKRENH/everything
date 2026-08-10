// Единственный семантический словарь Кутно. Старые v1/v2 оставлены как
// совместимые реэкспорты, чтобы клиент, Worker и тесты отвечали одинаково.

export const DEFAULT_BASE_INGREDIENTS = ["соль", "вода", "растительное масло", "сахар"];
export const SUGGESTED_BASE_INGREDIENTS = [
  ...DEFAULT_BASE_INGREDIENTS,
  "чёрный перец",
  "пшеничная мука",
  "уксус",
];
export const MANUAL_EQUIPMENT = ["руки", "нож", "разделочная доска", "миска", "ложка", "вилка"];

const EXACT_GROUPS = {
  tomato: ["помидор", "помидоры", "томат", "томаты", "свежие помидоры", "томаты черри", "помидоры черри", "томат черри"],
  "tomato-canned": ["консервированные помидоры", "томаты в собственном соку", "рубленые томаты"],
  "tomato-paste": ["томатная паста"],
  onion: ["лук", "репчатый лук", "лук репчатый", "красный лук", "белый лук", "луковица", "репчатая луковица"],
  "green-onion": ["зелёный лук", "лук зелёный", "перо лука"],
  leek: ["лук-порей", "порей"],
  garlic: ["чеснок", "зубчик чеснока", "зубчики чеснока"],
  potato: ["картофель", "картошка"],
  carrot: ["морковь"],
  egg: ["яйцо", "яйца", "яичный желток", "желток", "яичный белок", "белок яйца"],
  chicken: ["курица", "куриное мясо"],
  "chicken-thigh": ["куриное бедро", "бедро курицы", "куриные бедра", "куриные бёдра"],
  "chicken-breast": ["куриная грудка", "грудка курицы", "куриное филе", "филе курицы"],
  beef: ["говядина", "говяжье мясо"],
  pork: ["свинина", "свиное мясо"],
  lamb: ["баранина"],
  "ground-beef": ["фарш из говядины", "говяжий фарш", "фарш говяжий"],
  "ground-pork": ["фарш из свинины", "свиной фарш", "фарш свиной"],
  "ground-chicken": ["фарш из курицы", "куриный фарш", "фарш куриный"],
  bacon: ["бекон"],
  guanciale: ["гуанчале"],
  ham: ["ветчина"],
  fish: ["рыба", "рыбное филе"],
  salmon: ["лосось", "семга", "сёмга", "филе лосося", "филе семги", "филе сёмги", "красная рыба", "семга слабосоленая", "сёмга слабосолёная"],
  tuna: ["тунец", "консервированный тунец", "тунец консервированный"],
  shrimp: ["креветка", "креветки"],
  rice: ["рис", "длиннозерный рис", "длиннозернистый рис", "рис длиннозерный"],
  "rice-basmati": ["рис басмати", "басмати"],
  "rice-devzira": ["рис девзира", "девзира"],
  "rice-cooked": ["варёный рис", "готовый рис", "отварной рис"],
  pasta: ["макароны", "паста", "макаронные изделия"],
  spaghetti: ["спагетти"],
  noodles: ["лапша", "яичная лапша", "рисовая лапша"],
  flour: ["мука", "пшеничная мука"],
  bread: ["хлеб", "белый хлеб", "батон"],
  flatbread: ["пита", "лаваш", "лепёшка", "тортилья"],
  milk: ["молоко", "коровье молоко"],
  cream: ["сливки"],
  "coconut-milk": ["кокосовое молоко"],
  "coconut-cream": ["кокосовые сливки"],
  "condensed-milk": ["сгущенное молоко", "сгущённое молоко"],
  "milk-powder": ["сухое молоко"],
  yogurt: ["йогурт", "греческий йогурт"],
  sourcream: ["сметана"],
  butter: ["сливочное масло"],
  ghee: ["топлёное масло", "гхи"],
  "oil-vegetable": ["растительное масло", "подсолнечное масло", "нейтральное масло", "масло"],
  "oil-olive": ["оливковое масло", "масло оливковое"],
  cheese: ["сыр", "твёрдый сыр", "твердый сыр", "полутвёрдый сыр", "полутвердый сыр"],
  parmesan: ["пармезан", "пармиджано реджано", "грана падано"],
  pecorino: ["пекорино", "пекорино романо"],
  gruyere: ["грюйер", "сыр грюйер", "эмменталь", "комте"],
  mozzarella: ["моцарелла"],
  feta: ["фета", "брынза"],
  lemon: ["лимон", "лимонный сок", "сок лимона"],
  lime: ["лайм", "сок лайма", "лаймовый сок"],
  vinegar: ["уксус", "столовый уксус"],
  "vinegar-wine": ["винный уксус", "хересный уксус", "красный винный уксус", "бальзамический уксус"],
  "vinegar-rice": ["рисовый уксус"],
  soy: ["соевый соус", "светлый соевый соус", "тёмный соевый соус"],
  stock: ["бульон", "куриный бульон", "говяжий бульон", "овощной бульон"],
  chickpea: ["нут", "варёный нут"],
  lentil: ["чечевица", "красная чечевица", "зелёная чечевица"],
  mushroom: ["грибы", "шампиньоны", "шампиньоны свежие", "свежие шампиньоны", "вешенки"],
  pepper: ["сладкий перец", "болгарский перец"],
  chili: ["чили", "перец чили", "хлопья чили", "красный острый перец"],
  greens: ["зелень", "свежая зелень"],
  parsley: ["петрушка"],
  dill: ["укроп"],
  cilantro: ["кинза", "кориандр свежий"],
  basil: ["базилик", "свежий базилик"],
};

const PARENT = {
  "tomato-canned": "tomato",
  "chicken-thigh": "chicken",
  "chicken-breast": "chicken",
  "ground-beef": "beef",
  "ground-pork": "pork",
  "ground-chicken": "chicken",
  salmon: "fish",
  tuna: "fish",
  "rice-basmati": "rice",
  "rice-devzira": "rice",
  "rice-cooked": "rice",
  spaghetti: "pasta",
  parmesan: "cheese",
  pecorino: "cheese",
  gruyere: "cheese",
  mozzarella: "cheese",
  feta: "cheese",
  parsley: "greens",
  dill: "greens",
  cilantro: "greens",
  basil: "greens",
};

const SUBSTITUTIONS = {
  tomato: ["tomato-canned"],
  "tomato-canned": ["tomato"],
  spaghetti: ["pasta", "noodles"],
  pasta: ["spaghetti", "noodles"],
  parmesan: ["pecorino", "gruyere", "cheese"],
  pecorino: ["parmesan", "cheese"],
  gruyere: ["cheese", "parmesan"],
  mozzarella: ["cheese"],
  cream: ["milk", "sourcream", "yogurt"],
  milk: ["cream"],
  yogurt: ["sourcream"],
  sourcream: ["yogurt", "cream"],
  butter: ["ghee"],
  ghee: ["butter"],
  "oil-olive": ["oil-vegetable"],
  lemon: ["lime", "vinegar-wine"],
  lime: ["lemon"],
  "vinegar-wine": ["vinegar-rice", "vinegar"],
  "vinegar-rice": ["vinegar-wine", "vinegar"],
  bread: ["flatbread"],
  flatbread: ["bread"],
  parsley: ["dill", "cilantro", "greens"],
  dill: ["parsley", "cilantro", "greens"],
  cilantro: ["parsley", "dill", "greens"],
  basil: ["parsley", "greens"],
  guanciale: ["bacon"],
  bacon: ["guanciale", "ham"],
};

const OPTIONAL_FLAVORS = new Set([
  "петрушка", "укроп", "кинза", "тимьян", "орегано", "базилик", "паприка", "куркума", "зира", "кумин",
  "мускатный орех", "чили", "перец чили", "хлопья чили", "лавровый лист", "кунжут", "чёрный перец",
]);
const SERVING_WORDS = /для подачи|при подаче|украш|гарнир|по желанию|опциональн|необязательн/i;
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

const ALIAS_TO_ID = new Map();
for (const [id, aliases] of Object.entries(EXACT_GROUPS)) {
  for (const alias of aliases) ALIAS_TO_ID.set(normalizeIngredient(alias), id);
}
const ALIAS_ENTRIES = [...ALIAS_TO_ID.entries()].sort((a, b) => b[0].length - a[0].length);

function stemWord(value = "") {
  const word = normalizeIngredient(value).replace(/[^а-яa-z0-9]/gu, "");
  if (word.length <= 4) return word;
  return word.replace(/(?:иями|ями|ами|его|ого|ему|ому|ыми|ими|ой|ый|ий|ая|яя|ое|ее|ые|ие|ую|юю|ов|ев|ам|ям|ах|ях|ом|ем|у|ю|а|я|ы|и|е|о)$/u, "");
}

function textSignature(value = "") {
  return normalizeIngredient(value).split(/[\s-]+/).map(stemWord).filter((word) => word.length >= 3).join(" ");
}

export function canonicalIngredient(value = "") {
  const normalized = normalizedCommonName(value);
  if (ALIAS_TO_ID.has(normalized)) return ALIAS_TO_ID.get(normalized);
  for (const [alias, id] of ALIAS_ENTRIES) {
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

export function ingredientMatchAny(item, ownedIngredient) {
  const candidates = [item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])].filter(Boolean);
  const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
  let best = { type: "none" };
  for (const candidate of candidates) {
    const match = ingredientMatch(candidate, ownedIngredient);
    if (rank[match.type] > rank[best.type]) best = match;
    if (best.type === "exact") break;
  }
  return best;
}

function selectedBaseMatch(name, baseIngredients) {
  let best = { type: "none" };
  for (const base of baseIngredients) {
    const match = ingredientMatch(name, base);
    const rank = { none: 0, substitute: 1, category: 2, exact: 3 };
    if (rank[match.type] > rank[best.type]) best = match;
  }
  return best;
}

export function ingredientRole(item, recipe = {}, index = 0, baseIngredients = DEFAULT_BASE_INGREDIENTS) {
  if (item?.role === "required" || item?.role === "optional" || item?.role === "base") return item.role;
  const name = normalizedCommonName(item?.name);
  const baseMatch = selectedBaseMatch(name, baseIngredients);
  if (["exact", "category"].includes(baseMatch.type)) return "base";
  if (SERVING_WORDS.test(`${item?.note || ""} ${item?.name || ""}`)) return "optional";
  if (/черн.*перец|перец.*черн/.test(name)) return "optional";
  if (item?.pantry === true && !/оливков.*масл|мук|уксус/.test(name)) return "base";

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
  const baseIngredients = Array.isArray(context.baseIngredients) && context.baseIngredients.length ? context.baseIngredients : DEFAULT_BASE_INGREDIENTS;
  const ownedIngredients = [...new Set([...(Array.isArray(context.ingredients) ? context.ingredients.filter(Boolean) : []), ...baseIngredients])];
  const priorityIngredients = Array.isArray(context.priorityIngredients) ? context.priorityIngredients.filter(Boolean) : [];
  const selectedEquipment = (Array.isArray(context.equipment) ? context.equipment : []).map(normalizeEquipment);
  const enforceEquipment = context.enforceEquipment === true;
  const equipment = enforceEquipment ? [...new Set([...MANUAL_EQUIPMENT.map(normalizeEquipment), ...selectedEquipment])] : [];

  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((item, index) => {
    const role = ingredientRole(item, recipe, index, baseIngredients);
    let best = { type: role === "base" ? "base" : "none" };
    for (const owned of ownedIngredients) {
      const match = ingredientMatchAny(item, owned);
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
  const missingEquipment = enforceEquipment
    ? requiredEquipment.filter((required) => !equipment.includes(normalizeEquipment(required)))
    : [];
  const priorityHits = priorityIngredients.filter((priority) => ingredients.some((item) => ["exact", "category"].includes(ingredientMatchAny(item, priority).type)));

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
    ingredients: analysis.ingredients.map(({ match, ...item }) => ({
      ...item,
      matchType: match?.type || "none",
      matchedOwned: match?.owned || "",
    })),
    matching: {
      group: analysis.group,
      score: analysis.score,
      reasons: analysis.reasons,
      missingRequired: analysis.requiredMissing.map((item) => item.name),
      missingOptional: analysis.optionalMissing.map((item) => item.name),
      substitutions: analysis.substitutions.map((item) => ({ ingredient: item.name, owned: item.match?.owned || "" })),
      missingEquipment: analysis.missingEquipment,
      priorityHits: analysis.priorityHits,
    },
  };
}

const AUTOCOMPLETE_EXTRAS = [
  "абрикосы", "авокадо", "агар-агар", "аджика", "ананас", "анчоусы", "апельсины", "арахис", "арбуз",
  "баклажаны", "бананы", "белокочанная капуста", "брокколи", "булгур", "ваниль", "виноград", "вишня",
  "вустерширский соус", "голубика", "горчица", "горошек", "гранат", "грейпфрут", "гречка", "груши", "дайкон",
  "дижонская горчица", "дрожжи", "дыня", "жасминовый рис", "желатин", "зелёная фасоль", "зелёный горошек",
  "зира", "имбирь", "индейка", "кабачки", "какао", "каперсы", "капуста", "карри", "кефир", "киноа", "колбаса",
  "корень сельдерея", "кориандр", "корица", "корнишоны", "крабовые палочки", "красная фасоль", "краснокочанная капуста",
  "кукуруза", "кукурузная мука", "куркума", "кускус", "майонез", "малина", "манго", "манка", "маринованные огурцы",
  "мёд", "мидии", "миндаль", "мирин", "овсяные хлопья", "огурцы", "оливки", "орехи", "острый соус", "паприка",
  "паста мисо", "пекинская капуста", "перловка", "персики", "печень", "плавленый сыр", "прованские травы", "пшено",
  "редис", "репа", "рисовая мука", "розмарин", "руккола", "салат", "свёкла", "сельдерей", "семечки", "соевое молоко",
  "соус барбекю", "соус песто", "соус сальса", "соус терияки", "соус хойсин", "спаржа", "стручковая фасоль", "сухарики",
  "тахини", "творог", "тимьян", "томатный соус", "тофу", "тыква", "устрицы", "устричный соус", "фасоль", "фарш",
  "фунчоза", "хрен", "цветная капуста", "цукини", "шпинат", "яблоки", "ягоды", "ячневая крупа",
];

export const INGREDIENT_AUTOCOMPLETE = [...new Set([
  ...Object.values(EXACT_GROUPS).flat(),
  ...AUTOCOMPLETE_EXTRAS,
])].filter((item) => item.length > 1).sort((a, b) => a.localeCompare(b, "ru"));
