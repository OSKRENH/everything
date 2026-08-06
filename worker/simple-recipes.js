const SOURCE = {
  id: "simple-home-catalog",
  name: "Кутно · простая домашняя кухня",
  type: "kutno-simple-catalog",
  note: "Базовый домашний рецепт из проверенной коллекции Кутно.",
  url: "",
  license: "",
};

const ingredient = (name, amount, unit, options = {}) => ({ name, amount, unit, ...options });

const RECIPES = [
  {
    id: "simple-omelette",
    title: "Омлет",
    subtitle: "Нежный омлет из яиц на сковороде",
    cuisine: "Домашняя кухня",
    flag: "🍳",
    course: "завтрак",
    protein: "без мяса",
    minutes: 10,
    difficulty: "легко",
    servings: 2,
    equipment: ["Сковорода", "Миска", "Вилка"],
    ingredients: [
      ingredient("яйца", 4, "шт."),
      ingredient("вода", 40, "мл", { aliases: ["молоко"], pantry: true }),
      ingredient("растительное масло", 10, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
    ],
    steps: [
      "Разбейте яйца в миску, добавьте воду и соль, затем перемешайте вилкой до однородности.",
      "Разогрейте сковороду с маслом на среднем огне и вылейте яичную смесь.",
      "Готовьте под крышкой 5–7 минут на слабом огне, пока середина омлета не схватится.",
    ],
    nutrition: { calories: 245, protein: 16, fat: 19, carbs: 1 },
    tip: "Не взбивайте яйца слишком долго: достаточно соединить белки и желтки.",
  },
  {
    id: "simple-fried-eggs",
    title: "Яичница-глазунья",
    subtitle: "Самая простая яичница с жидким или плотным желтком",
    cuisine: "Домашняя кухня",
    flag: "🍳",
    course: "завтрак",
    protein: "без мяса",
    minutes: 7,
    difficulty: "легко",
    servings: 2,
    equipment: ["Сковорода"],
    ingredients: [
      ingredient("яйца", 4, "шт."),
      ingredient("растительное масло", 10, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
    ],
    steps: [
      "Разогрейте сковороду с маслом на среднем огне.",
      "Аккуратно разбейте яйца, стараясь сохранить желтки целыми, и слегка посолите белки.",
      "Готовьте 3–5 минут: без крышки для жидкого желтка или под крышкой для более плотного.",
    ],
    nutrition: { calories: 250, protein: 19, fat: 19, carbs: 1 },
    tip: "Солите белок, а не желток — на желтке от соли появляются светлые пятна.",
  },
  {
    id: "simple-eggs-onion",
    title: "Яичница с луком",
    subtitle: "Обжаренный лук и яйца на одной сковороде",
    cuisine: "Домашняя кухня",
    flag: "🍳",
    course: "завтрак",
    protein: "без мяса",
    minutes: 12,
    difficulty: "легко",
    servings: 2,
    equipment: ["Сковорода", "Нож", "Разделочная доска"],
    ingredients: [
      ingredient("яйца", 4, "шт."),
      ingredient("репчатый лук", 100, "г", { aliases: ["лук"] }),
      ingredient("растительное масло", 15, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
    ],
    steps: [
      "Нарежьте лук тонкими полукольцами или небольшими кубиками.",
      "Обжарьте лук в масле 5–6 минут до мягкости и лёгкого золотистого цвета.",
      "Разбейте сверху яйца, посолите и готовьте ещё 3–5 минут до желаемой плотности желтка.",
    ],
    nutrition: { calories: 300, protein: 19, fat: 22, carbs: 8 },
    tip: "Лук должен сначала стать мягким — после добавления яиц он почти перестаёт готовиться.",
  },
  {
    id: "simple-boiled-eggs",
    title: "Яйца вкрутую",
    subtitle: "Ровно сваренные яйца без серого ободка",
    cuisine: "Домашняя кухня",
    flag: "🥚",
    course: "завтрак",
    protein: "без мяса",
    minutes: 12,
    difficulty: "легко",
    servings: 2,
    equipment: ["Кастрюля"],
    ingredients: [
      ingredient("яйца", 4, "шт."),
      ingredient("вода", 1000, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true, role: "optional" }),
    ],
    steps: [
      "Положите яйца в кастрюлю в один слой и залейте холодной водой на 2–3 см выше яиц.",
      "Доведите до кипения, уменьшите огонь и варите 9 минут.",
      "Сразу переложите яйца в холодную воду на 5 минут, затем очистите.",
    ],
    nutrition: { calories: 215, protein: 19, fat: 15, carbs: 1 },
    tip: "Быстрое охлаждение останавливает варку и не даёт желтку посереть.",
  },
  {
    id: "simple-fried-potatoes-onion",
    title: "Жареная картошка с луком",
    subtitle: "Золотистый картофель с мягким сладким луком",
    cuisine: "Домашняя кухня",
    flag: "🥔",
    course: "основное",
    protein: "без мяса",
    minutes: 35,
    difficulty: "легко",
    servings: 2,
    equipment: ["Сковорода", "Нож", "Разделочная доска"],
    ingredients: [
      ingredient("картофель", 600, "г", { aliases: ["картошка"] }),
      ingredient("репчатый лук", 120, "г", { aliases: ["лук"] }),
      ingredient("растительное масло", 35, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
    ],
    steps: [
      "Нарежьте картофель брусочками, промойте холодной водой и тщательно обсушите.",
      "Разогрейте широкую сковороду с маслом, выложите картофель одним слоем и жарьте 12 минут, переворачивая не слишком часто.",
      "Добавьте нарезанный лук, жарьте ещё 10–12 минут до готовности и посолите в самом конце.",
    ],
    nutrition: { calories: 420, protein: 7, fat: 18, carbs: 58 },
    tip: "Сухой картофель и просторная сковорода нужны для корочки, а не тушения.",
  },
  {
    id: "simple-boiled-potatoes",
    title: "Отварной картофель",
    subtitle: "Простой картофель кусочками или целиком",
    cuisine: "Домашняя кухня",
    flag: "🥔",
    course: "основное",
    protein: "без мяса",
    minutes: 30,
    difficulty: "легко",
    servings: 2,
    equipment: ["Кастрюля", "Нож"],
    ingredients: [
      ingredient("картофель", 600, "г", { aliases: ["картошка"] }),
      ingredient("вода", 1200, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
      ingredient("сливочное масло", 20, "г", { role: "optional" }),
    ],
    steps: [
      "Очистите картофель и нарежьте крупные клубни на одинаковые части.",
      "Залейте холодной водой, посолите, доведите до кипения и варите на слабом огне 18–25 минут.",
      "Слейте воду, верните кастрюлю на выключенную тёплую конфорку на минуту и при желании добавьте масло.",
    ],
    nutrition: { calories: 310, protein: 6, fat: 8, carbs: 54 },
    tip: "Готовый картофель легко прокалывается ножом, но не разваливается от прикосновения.",
  },
  {
    id: "simple-mashed-potatoes",
    title: "Картофельное пюре",
    subtitle: "Мягкое домашнее пюре без комков",
    cuisine: "Домашняя кухня",
    flag: "🥔",
    course: "основное",
    protein: "без мяса",
    minutes: 35,
    difficulty: "легко",
    servings: 2,
    equipment: ["Кастрюля"],
    ingredients: [
      ingredient("картофель", 600, "г", { aliases: ["картошка"] }),
      ingredient("вода", 1200, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
      ingredient("молоко", 120, "мл", { role: "optional" }),
      ingredient("сливочное масло", 30, "г", { role: "optional" }),
    ],
    steps: [
      "Очистите картофель, нарежьте одинаковыми кусками и сварите в подсоленной воде до полной мягкости.",
      "Слейте воду и разомните горячий картофель толкушкой или крепкой вилкой.",
      "Постепенно вмешайте горячее молоко или немного картофельного отвара, при желании добавьте масло.",
    ],
    nutrition: { calories: 365, protein: 8, fat: 12, carbs: 57 },
    tip: "Не используйте блендер: он разрушает структуру крахмала и превращает пюре в клейкую массу.",
  },
  {
    id: "simple-potato-egg-salad",
    title: "Картофельный салат с яйцом",
    subtitle: "Сытный салат из картофеля, яиц и лука",
    cuisine: "Домашняя кухня",
    flag: "🥗",
    course: "салат",
    protein: "без мяса",
    minutes: 35,
    difficulty: "легко",
    servings: 2,
    equipment: ["Кастрюля", "Нож", "Разделочная доска", "Миска"],
    ingredients: [
      ingredient("картофель", 450, "г", { aliases: ["картошка"] }),
      ingredient("яйца", 3, "шт."),
      ingredient("репчатый лук", 70, "г", { aliases: ["лук"] }),
      ingredient("растительное масло", 25, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
      ingredient("чёрный перец", 0, "", { pantry: true, role: "optional" }),
    ],
    steps: [
      "Отдельно сварите картофель до мягкости, а яйца — вкрутую, затем полностью остудите.",
      "Нарежьте картофель и яйца крупными кубиками, лук — очень мелко.",
      "Смешайте всё с растительным маслом, солью и перцем, стараясь не размять картофель.",
    ],
    nutrition: { calories: 455, protein: 17, fat: 20, carbs: 53 },
    tip: "Остывший картофель лучше сохраняет форму и не впитывает всё масло сразу.",
  },
  {
    id: "simple-potato-pancakes",
    title: "Драники",
    subtitle: "Хрустящие картофельные оладьи с луком",
    cuisine: "Белорусская кухня",
    flag: "🥔",
    course: "основное",
    protein: "без мяса",
    minutes: 35,
    difficulty: "обычно",
    servings: 2,
    equipment: ["Сковорода", "Миска", "Тёрка"],
    ingredients: [
      ingredient("картофель", 600, "г", { aliases: ["картошка"] }),
      ingredient("репчатый лук", 100, "г", { aliases: ["лук"] }),
      ingredient("яйца", 1, "шт."),
      ingredient("мука", 25, "г", { role: "optional" }),
      ingredient("растительное масло", 45, "мл", { pantry: true }),
      ingredient("соль", 0, "", { pantry: true }),
    ],
    steps: [
      "Натрите картофель и лук на мелкой тёрке, затем слегка отожмите лишнюю жидкость.",
      "Добавьте яйцо, соль и при необходимости муку, чтобы масса держалась на ложке.",
      "Жарьте небольшие оладьи в разогретом масле по 3–4 минуты с каждой стороны до золотистой корочки.",
    ],
    nutrition: { calories: 510, protein: 13, fat: 23, carbs: 66 },
    tip: "Лук замедляет потемнение тёртого картофеля и делает вкус мягче.",
  },
];

function formatNumber(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function scaledAmount(item, factor) {
  if (!Number.isFinite(Number(item.amount)) || Number(item.amount) === 0) return "по вкусу";
  let value = Number(item.amount) * factor;
  if (/г|мл/.test(item.unit)) value = Math.max(5, Math.round(value / 5) * 5);
  else if (/шт/.test(item.unit)) value = Math.max(1, Math.round(value));
  else value = Math.round(value * 4) / 4;
  return `${formatNumber(value)} ${item.unit}`.trim();
}

export function simpleRecipesForPortions(portions = 2) {
  const target = Math.min(8, Math.max(1, Number(portions) || 2));
  return RECIPES.map((recipe) => {
    const factor = target / recipe.servings;
    return {
      ...recipe,
      id: `simple:${recipe.id}`,
      ingredients: recipe.ingredients.map(({ amount, unit, ...item }) => ({
        ...item,
        amount: scaledAmount({ amount, unit }, factor),
      })),
      portions: target,
      source: { ...SOURCE, id: `simple:${recipe.id}` },
      uses: [],
      missing: [],
      why: "Простой домашний рецепт из продуктов, которые уже есть.",
      nutrition: { ...recipe.nutrition, estimated: true },
    };
  });
}
