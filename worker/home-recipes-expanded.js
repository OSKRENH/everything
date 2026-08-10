const SOURCE = {
  id: "kutno-home-expanded-2026-08",
  name: "Кутно · домашнее ядро",
  type: "kutno-home-catalog",
  note: "Редакционная домашняя рецептура Кутно для повседневной готовки.",
  url: "",
  license: "CC BY-SA 4.0",
};

const pantry = (name, amount = 0, unit = "") => ({ name, amount, unit, pantry: true });
const ingredient = (name, amount, unit, options = {}) => ({ name, amount, unit, ...options });

function displayAmount(item, portions) {
  if (!Number.isFinite(Number(item.amount)) || Number(item.amount) === 0) return item.amountText || "по вкусу";
  const value = Number(item.amount) * portions / 2;
  const unit = String(item.unit || "").trim();
  let rounded = value;
  if (["г", "мл"].includes(unit)) rounded = Math.max(5, Math.round(value / 5) * 5);
  else rounded = Math.max(0.25, Math.round(value * 4) / 4);
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${text} ${unit}`.trim();
}

function family(definition) {
  return definition.variants.map((variant) => ({
    id: `home-${definition.id}-${variant.id}`,
    title: variant.title,
    subtitle: variant.subtitle || definition.subtitle,
    cuisine: "Домашняя кухня",
    flag: variant.flag || definition.flag || "🍽️",
    course: variant.course || definition.course || "основное",
    protein: variant.protein || definition.protein || "без мяса",
    minutes: variant.minutes || definition.minutes || 30,
    difficulty: variant.difficulty || definition.difficulty || "легко",
    servings: 2,
    equipment: variant.equipment || definition.equipment || [],
    ingredients: [
      ...definition.baseIngredients,
      ...(variant.ingredients || [ingredient(variant.ingredient, variant.amount, variant.unit)]),
      ...(definition.pantry || []),
    ].filter((item) => item?.name),
    steps: definition.steps(variant),
    nutrition: {
      calories: Math.max(120, (definition.nutrition?.calories || 300) + (variant.calories || 0)),
      protein: Math.max(3, (definition.nutrition?.protein || 12) + (variant.proteinDelta || 0)),
      fat: Math.max(2, (definition.nutrition?.fat || 10) + (variant.fatDelta || 0)),
      carbs: Math.max(2, (definition.nutrition?.carbs || 35) + (variant.carbsDelta || 0)),
      estimated: true,
    },
    tip: variant.tip || definition.tip || "Пробуйте блюдо перед подачей и корректируйте соль в самом конце.",
    source: { ...SOURCE, id: `home-${definition.id}-${variant.id}` },
  }));
}

const FAMILIES = [
  {
    id: "omelette", subtitle: "Быстрый омлет из привычных продуктов", flag: "🍳", course: "завтрак", minutes: 12, equipment: ["Сковорода", "Миска", "Вилка"],
    baseIngredients: [ingredient("яйца", 4, "шт.")], pantry: [pantry("растительное масло", 10, "мл"), pantry("соль")], nutrition: { calories: 250, protein: 18, fat: 18, carbs: 3 },
    variants: [
      { id: "cheese", title: "Омлет с сыром", ingredient: "сыр", amount: 60, unit: "г", calories: 90 },
      { id: "tomato", title: "Омлет с помидорами", ingredient: "помидоры", amount: 160, unit: "г" },
      { id: "mushroom", title: "Омлет с грибами", ingredient: "грибы", amount: 140, unit: "г", calories: 30 },
      { id: "ham", title: "Омлет с ветчиной", ingredient: "ветчина", amount: 100, unit: "г", protein: "мясо", calories: 120 },
      { id: "spinach", title: "Омлет со шпинатом", ingredient: "шпинат", amount: 80, unit: "г" },
      { id: "green-onion", title: "Омлет с зелёным луком", ingredient: "зелёный лук", amount: 40, unit: "г" },
    ],
    steps: (v) => [`Подготовьте ${v.ingredient} и нарежьте при необходимости.`, "Перемешайте яйца с солью до однородности.", `Прогрейте ${v.ingredient} на сковороде, залейте яйцами и готовьте под крышкой 5–7 минут.`],
  },
  {
    id: "fried-eggs", subtitle: "Яичница на одной сковороде", flag: "🍳", course: "завтрак", minutes: 14, equipment: ["Сковорода"],
    baseIngredients: [ingredient("яйца", 4, "шт.")], pantry: [pantry("растительное масло", 10, "мл"), pantry("соль")], nutrition: { calories: 245, protein: 18, fat: 18, carbs: 2 },
    variants: [
      { id: "onion", title: "Яичница с репчатым луком", ingredient: "репчатый лук", amount: 100, unit: "г" },
      { id: "tomato", title: "Яичница с помидорами", ingredient: "помидоры", amount: 180, unit: "г" },
      { id: "cheese", title: "Яичница с сыром", ingredient: "сыр", amount: 60, unit: "г", calories: 90 },
      { id: "mushroom", title: "Яичница с шампиньонами", ingredient: "шампиньоны", amount: 140, unit: "г" },
      { id: "ham", title: "Яичница с ветчиной", ingredient: "ветчина", amount: 90, unit: "г", protein: "мясо", calories: 110 },
      { id: "potato", title: "Яичница с картофелем", ingredient: "картофель", amount: 300, unit: "г", minutes: 25, calories: 180 },
    ],
    steps: (v) => [`Нарежьте ${v.ingredient} небольшими кусочками.`, `Обжарьте ${v.ingredient} до готовности на растительном масле.`, "Разбейте сверху яйца, посолите и готовьте 3–5 минут до желаемой плотности желтка."],
  },
  {
    id: "potato-pan", subtitle: "Румяный картофель для обычного ужина", flag: "🥔", minutes: 35, equipment: ["Сковорода", "Нож"],
    baseIngredients: [ingredient("картофель", 600, "г")], pantry: [pantry("растительное масло", 30, "мл"), pantry("соль")], nutrition: { calories: 410, protein: 8, fat: 16, carbs: 58 },
    variants: [
      { id: "mushroom", title: "Жареный картофель с грибами", ingredient: "грибы", amount: 220, unit: "г" },
      { id: "bacon", title: "Жареный картофель с беконом", ingredient: "бекон", amount: 120, unit: "г", protein: "мясо", calories: 160 },
      { id: "chicken", title: "Жареный картофель с курицей", ingredient: "курица", amount: 250, unit: "г", protein: "мясо", calories: 180 },
      { id: "egg", title: "Жареный картофель с яйцом", ingredient: "яйца", amount: 2, unit: "шт.", calories: 110 },
      { id: "cheese", title: "Жареный картофель с сыром", ingredient: "сыр", amount: 80, unit: "г", calories: 120 },
      { id: "pepper", title: "Жареный картофель с болгарским перцем", ingredient: "болгарский перец", amount: 180, unit: "г" },
    ],
    steps: (v) => ["Нарежьте картофель брусочками и обсушите.", "Обжарьте картофель на широкой сковороде до румяной корочки.", `Добавьте ${v.ingredient}, доведите всё до готовности и посолите перед подачей.`],
  },
  {
    id: "potato-bake", subtitle: "Простой картофель из духовки", flag: "🥔", minutes: 50, equipment: ["Духовка", "Нож"],
    baseIngredients: [ingredient("картофель", 650, "г")], pantry: [pantry("растительное масло", 25, "мл"), pantry("соль")], nutrition: { calories: 390, protein: 8, fat: 13, carbs: 59 },
    variants: [
      { id: "cheese", title: "Запечённый картофель с сыром", ingredient: "сыр", amount: 90, unit: "г", calories: 130 },
      { id: "chicken", title: "Картофель, запечённый с курицей", ingredient: "курица", amount: 300, unit: "г", protein: "мясо", calories: 190 },
      { id: "mushroom", title: "Картофель, запечённый с грибами", ingredient: "грибы", amount: 250, unit: "г" },
      { id: "tomato", title: "Картофель, запечённый с помидорами", ingredient: "помидоры", amount: 220, unit: "г" },
      { id: "onion", title: "Картофель, запечённый с луком", ingredient: "репчатый лук", amount: 160, unit: "г" },
      { id: "fish", title: "Картофель, запечённый с рыбой", ingredient: "рыба", amount: 300, unit: "г", protein: "рыба и морепродукты", calories: 170 },
    ],
    steps: (v) => ["Нарежьте картофель тонкими дольками и перемешайте с маслом и солью.", `Добавьте ${v.ingredient} и распределите всё в форме одним слоем.`, "Запекайте при 200 °C до мягкости картофеля и готовности добавки, около 35–45 минут."],
  },
  {
    id: "pasta-basic", subtitle: "Паста без сложного соуса", flag: "🍝", minutes: 25, equipment: ["Кастрюля", "Сковорода"],
    baseIngredients: [ingredient("макароны", 220, "г")], pantry: [pantry("растительное масло", 15, "мл"), pantry("соль")], nutrition: { calories: 430, protein: 14, fat: 10, carbs: 70 },
    variants: [
      { id: "cheese", title: "Макароны с сыром", ingredient: "сыр", amount: 90, unit: "г", calories: 150 },
      { id: "tomato", title: "Макароны с помидорами", ingredient: "помидоры", amount: 250, unit: "г" },
      { id: "tuna", title: "Макароны с тунцом", ingredient: "тунец", amount: 160, unit: "г", protein: "рыба и морепродукты", calories: 110 },
      { id: "chicken", title: "Макароны с курицей", ingredient: "курица", amount: 250, unit: "г", protein: "мясо", calories: 170 },
      { id: "mushroom", title: "Макароны с грибами", ingredient: "грибы", amount: 220, unit: "г" },
      { id: "bacon", title: "Макароны с беконом", ingredient: "бекон", amount: 120, unit: "г", protein: "мясо", calories: 160 },
    ],
    steps: (v) => ["Отварите макароны в подсоленной воде до готовности и сохраните немного воды от варки.", `Подготовьте ${v.ingredient} на сковороде до готовности.`, "Смешайте макароны с добавкой, при необходимости влейте немного воды от варки и прогрейте 2 минуты."],
  },
  {
    id: "pasta-creamy", subtitle: "Домашняя паста с мягким соусом", flag: "🍝", minutes: 30, equipment: ["Кастрюля", "Сковорода"],
    baseIngredients: [ingredient("макароны", 220, "г"), ingredient("сливки", 180, "мл")], pantry: [pantry("соль")], nutrition: { calories: 560, protein: 16, fat: 23, carbs: 70 },
    variants: [
      { id: "mushroom", title: "Паста в сливках с грибами", ingredient: "грибы", amount: 220, unit: "г" },
      { id: "chicken", title: "Паста в сливках с курицей", ingredient: "курица", amount: 250, unit: "г", protein: "мясо", calories: 170 },
      { id: "ham", title: "Паста в сливках с ветчиной", ingredient: "ветчина", amount: 130, unit: "г", protein: "мясо", calories: 120 },
      { id: "spinach", title: "Паста в сливках со шпинатом", ingredient: "шпинат", amount: 120, unit: "г" },
      { id: "broccoli", title: "Паста в сливках с брокколи", ingredient: "брокколи", amount: 220, unit: "г" },
      { id: "cheese", title: "Сливочная паста с сыром", ingredient: "сыр", amount: 90, unit: "г", calories: 140 },
    ],
    steps: (v) => ["Отварите пасту до состояния al dente.", `Приготовьте ${v.ingredient} в сковороде, влейте сливки и прогрейте без бурного кипения.`, "Добавьте пасту, перемешайте и прогрейте вместе 2–3 минуты."],
  },
  {
    id: "fried-rice", subtitle: "Рис на сковороде из вчерашних запасов", flag: "🍚", minutes: 22, equipment: ["Сковорода"],
    baseIngredients: [ingredient("варёный рис", 350, "г")], pantry: [pantry("растительное масло", 15, "мл"), pantry("соль")], nutrition: { calories: 390, protein: 9, fat: 9, carbs: 68 },
    variants: [
      { id: "egg", title: "Жареный рис с яйцом", ingredient: "яйца", amount: 2, unit: "шт.", calories: 110 },
      { id: "chicken", title: "Жареный рис с курицей", ingredient: "курица", amount: 220, unit: "г", protein: "мясо", calories: 160 },
      { id: "mushroom", title: "Жареный рис с грибами", ingredient: "грибы", amount: 200, unit: "г" },
      { id: "tuna", title: "Жареный рис с тунцом", ingredient: "тунец", amount: 150, unit: "г", protein: "рыба и морепродукты", calories: 100 },
      { id: "bacon", title: "Жареный рис с беконом", ingredient: "бекон", amount: 110, unit: "г", protein: "мясо", calories: 150 },
      { id: "vegetables", title: "Жареный рис с овощами", ingredients: [ingredient("морковь", 100, "г"), ingredient("болгарский перец", 120, "г")], calories: 30 },
    ],
    steps: (v) => ["Разогрейте широкую сковороду с небольшим количеством масла.", `Быстро приготовьте ${v.ingredient || "овощи"} до готовности.`, "Добавьте холодный варёный рис и обжаривайте 5–7 минут, разбивая комочки лопаткой."],
  },
  {
    id: "rice-pot", subtitle: "Рис и добавка в одной кастрюле", flag: "🍚", minutes: 40, equipment: ["Кастрюля"],
    baseIngredients: [ingredient("рис", 180, "г"), ingredient("вода", 380, "мл", { pantry: true })], pantry: [pantry("соль")], nutrition: { calories: 360, protein: 8, fat: 4, carbs: 72 },
    variants: [
      { id: "chicken", title: "Рис с курицей в одной кастрюле", ingredient: "курица", amount: 280, unit: "г", protein: "мясо", calories: 180 },
      { id: "beef", title: "Рис с говядиной в одной кастрюле", ingredient: "говядина", amount: 260, unit: "г", protein: "мясо", calories: 200, minutes: 50 },
      { id: "mushroom", title: "Рис с грибами в одной кастрюле", ingredient: "грибы", amount: 230, unit: "г" },
      { id: "tomato", title: "Рис с помидорами", ingredient: "помидоры", amount: 250, unit: "г" },
      { id: "lentil", title: "Рис с чечевицей", ingredient: "чечевица", amount: 130, unit: "г", calories: 120 },
      { id: "vegetables", title: "Рис с морковью и перцем", ingredients: [ingredient("морковь", 120, "г"), ingredient("болгарский перец", 150, "г")] },
    ],
    steps: (v) => [`Подготовьте ${v.ingredient || "овощи"} и при необходимости слегка обжарьте на дне кастрюли.`, "Добавьте промытый рис, воду и соль.", "Доведите до кипения и готовьте под крышкой на слабом огне до мягкости риса."],
  },
  {
    id: "buckwheat", subtitle: "Гречка для будничного ужина", flag: "🌾", minutes: 32, equipment: ["Кастрюля", "Сковорода"],
    baseIngredients: [ingredient("гречка", 180, "г"), ingredient("вода", 360, "мл", { pantry: true })], pantry: [pantry("соль")], nutrition: { calories: 340, protein: 12, fat: 4, carbs: 64 },
    variants: [
      { id: "mushroom", title: "Гречка с шампиньонами", ingredient: "шампиньоны", amount: 230, unit: "г" },
      { id: "chicken", title: "Гречка с курицей", ingredient: "курица", amount: 250, unit: "г", protein: "мясо", calories: 170 },
      { id: "onion", title: "Гречка с жареным луком", ingredient: "репчатый лук", amount: 150, unit: "г" },
      { id: "egg", title: "Гречка с яйцом", ingredient: "яйца", amount: 2, unit: "шт.", calories: 110 },
      { id: "beef", title: "Гречка с говядиной", ingredient: "говядина", amount: 250, unit: "г", protein: "мясо", calories: 200, minutes: 45 },
      { id: "vegetables", title: "Гречка с морковью и перцем", ingredients: [ingredient("морковь", 120, "г"), ingredient("болгарский перец", 140, "г")] },
    ],
    steps: (v) => ["Отварите гречку в подсоленной воде до готовности и оставьте под крышкой.", `Отдельно приготовьте ${v.ingredient || "овощи"} до мягкости и лёгкой корочки.`, "Соедините с гречкой и прогрейте вместе 2–3 минуты."],
  },
  {
    id: "oatmeal", subtitle: "Овсяная каша из простых добавок", flag: "🥣", course: "завтрак", minutes: 12, equipment: ["Кастрюля"],
    baseIngredients: [ingredient("овсяные хлопья", 100, "г"), ingredient("молоко", 300, "мл")], pantry: [pantry("сахар")], nutrition: { calories: 330, protein: 12, fat: 8, carbs: 50 },
    variants: [
      { id: "banana", title: "Овсяная каша с бананом", ingredient: "бананы", amount: 1, unit: "шт.", calories: 90 },
      { id: "apple", title: "Овсяная каша с яблоком", ingredient: "яблоки", amount: 1, unit: "шт.", calories: 60 },
      { id: "berries", title: "Овсяная каша с ягодами", ingredient: "ягоды", amount: 120, unit: "г", calories: 50 },
      { id: "cocoa", title: "Овсяная каша с какао", ingredient: "какао", amount: 15, unit: "г", calories: 40 },
      { id: "honey", title: "Овсяная каша с мёдом", ingredient: "мёд", amount: 25, unit: "г", calories: 80 },
      { id: "nuts", title: "Овсяная каша с орехами", ingredient: "орехи", amount: 35, unit: "г", calories: 200 },
    ],
    steps: (v) => ["Доведите молоко до слабого кипения.", "Всыпьте овсяные хлопья и варите 5–7 минут, помешивая.", `Добавьте ${v.ingredient} и подавайте кашу горячей.`],
  },
  {
    id: "chicken-pan", subtitle: "Курица на сковороде без сложной подготовки", flag: "🍗", protein: "мясо", minutes: 32, equipment: ["Сковорода", "Нож"],
    baseIngredients: [ingredient("курица", 400, "г")], pantry: [pantry("растительное масло", 15, "мл"), pantry("соль")], nutrition: { calories: 420, protein: 48, fat: 20, carbs: 5 },
    variants: [
      { id: "onion", title: "Курица с луком на сковороде", ingredient: "репчатый лук", amount: 160, unit: "г" },
      { id: "mushroom", title: "Курица с грибами на сковороде", ingredient: "грибы", amount: 230, unit: "г" },
      { id: "tomato", title: "Курица с помидорами на сковороде", ingredient: "помидоры", amount: 250, unit: "г" },
      { id: "cream", title: "Курица в сливках", ingredient: "сливки", amount: 180, unit: "мл", calories: 170 },
      { id: "cheese", title: "Курица с сыром на сковороде", ingredient: "сыр", amount: 90, unit: "г", calories: 140 },
      { id: "pepper", title: "Курица с болгарским перцем", ingredient: "болгарский перец", amount: 220, unit: "г" },
    ],
    steps: (v) => ["Нарежьте курицу одинаковыми кусочками и слегка посолите.", "Обжарьте курицу до румяной корочки.", `Добавьте ${v.ingredient}, уменьшите огонь и готовьте до полной готовности курицы.`],
  },
  {
    id: "chicken-oven", subtitle: "Курица из духовки для семейного ужина", flag: "🍗", protein: "мясо", minutes: 50, equipment: ["Духовка"],
    baseIngredients: [ingredient("курица", 500, "г")], pantry: [pantry("растительное масло", 15, "мл"), pantry("соль")], nutrition: { calories: 450, protein: 52, fat: 22, carbs: 4 },
    variants: [
      { id: "potato", title: "Курица, запечённая с картофелем", ingredient: "картофель", amount: 600, unit: "г", calories: 300 },
      { id: "tomato", title: "Курица, запечённая с помидорами", ingredient: "помидоры", amount: 260, unit: "г" },
      { id: "cheese", title: "Курица, запечённая под сыром", ingredient: "сыр", amount: 100, unit: "г", calories: 160 },
      { id: "mushroom", title: "Курица, запечённая с грибами", ingredient: "грибы", amount: 250, unit: "г" },
      { id: "onion", title: "Курица, запечённая с луком", ingredient: "репчатый лук", amount: 180, unit: "г" },
      { id: "broccoli", title: "Курица, запечённая с брокколи", ingredient: "брокколи", amount: 300, unit: "г" },
    ],
    steps: (v) => ["Посолите курицу и смажьте небольшим количеством масла.", `Разложите курицу и ${v.ingredient} в форме.`, "Запекайте при 200 °C до полной готовности курицы, около 35–45 минут."],
  },
  {
    id: "ground-meat", subtitle: "Сытное блюдо с фаршем", flag: "🍲", protein: "мясо", minutes: 35, equipment: ["Сковорода"],
    baseIngredients: [ingredient("фарш", 350, "г"), ingredient("репчатый лук", 120, "г")], pantry: [pantry("растительное масло", 10, "мл"), pantry("соль")], nutrition: { calories: 480, protein: 35, fat: 28, carbs: 12 },
    variants: [
      { id: "pasta", title: "Макароны с фаршем", ingredient: "макароны", amount: 220, unit: "г", calories: 320, equipment: ["Сковорода", "Кастрюля"] },
      { id: "rice", title: "Рис с фаршем", ingredient: "рис", amount: 180, unit: "г", calories: 260 },
      { id: "potato", title: "Картофель с фаршем на сковороде", ingredient: "картофель", amount: 550, unit: "г", calories: 280 },
      { id: "buckwheat", title: "Гречка с фаршем", ingredient: "гречка", amount: 180, unit: "г", calories: 240 },
      { id: "tomato", title: "Фарш с помидорами", ingredient: "помидоры", amount: 300, unit: "г" },
      { id: "cabbage", title: "Тушёная капуста с фаршем", ingredient: "капуста", amount: 500, unit: "г" },
    ],
    steps: (v) => ["Обжарьте лук до мягкости, добавьте фарш и разбейте его лопаткой.", `Добавьте ${v.ingredient} и перемешайте.`, "Готовьте до полной готовности фарша и основного продукта; при необходимости добавьте немного воды."],
  },
  {
    id: "fish-pan", subtitle: "Рыба для быстрого домашнего ужина", flag: "🐟", protein: "рыба и морепродукты", minutes: 30, equipment: ["Сковорода"],
    baseIngredients: [ingredient("рыба", 400, "г")], pantry: [pantry("растительное масло", 15, "мл"), pantry("соль")], nutrition: { calories: 360, protein: 44, fat: 17, carbs: 4 },
    variants: [
      { id: "onion", title: "Рыба с луком на сковороде", ingredient: "репчатый лук", amount: 150, unit: "г" },
      { id: "tomato", title: "Рыба с помидорами на сковороде", ingredient: "помидоры", amount: 250, unit: "г" },
      { id: "cream", title: "Рыба в сливочном соусе", ingredient: "сливки", amount: 170, unit: "мл", calories: 160 },
      { id: "potato", title: "Рыба с картофелем на сковороде", ingredient: "картофель", amount: 500, unit: "г", calories: 250, minutes: 40 },
      { id: "pepper", title: "Рыба с болгарским перцем", ingredient: "болгарский перец", amount: 220, unit: "г" },
      { id: "lemon", title: "Рыба с лимоном", ingredient: "лимон", amount: 1, unit: "шт." },
    ],
    steps: (v) => ["Нарежьте рыбу порционными кусочками и посолите.", "Обжарьте рыбу на среднем огне до лёгкой корочки.", `Добавьте ${v.ingredient} и доведите блюдо до готовности на умеренном огне.`],
  },
  {
    id: "chicken-soup", subtitle: "Лёгкий суп на каждый день", flag: "🍲", course: "суп", protein: "мясо", minutes: 45, equipment: ["Кастрюля"],
    baseIngredients: [ingredient("курица", 300, "г"), ingredient("вода", 1300, "мл", { pantry: true }), ingredient("репчатый лук", 100, "г")], pantry: [pantry("соль")], nutrition: { calories: 300, protein: 30, fat: 10, carbs: 22 },
    variants: [
      { id: "potato", title: "Куриный суп с картофелем", ingredient: "картофель", amount: 400, unit: "г", calories: 130 },
      { id: "rice", title: "Куриный суп с рисом", ingredient: "рис", amount: 90, unit: "г", calories: 120 },
      { id: "noodle", title: "Куриный суп с лапшой", ingredient: "лапша", amount: 100, unit: "г", calories: 140 },
      { id: "buckwheat", title: "Куриный суп с гречкой", ingredient: "гречка", amount: 90, unit: "г", calories: 110 },
      { id: "lentil", title: "Куриный суп с чечевицей", ingredient: "чечевица", amount: 100, unit: "г", calories: 120 },
      { id: "vegetables", title: "Куриный суп с овощами", ingredients: [ingredient("морковь", 130, "г"), ingredient("картофель", 250, "г")] },
    ],
    steps: (v) => ["Залейте курицу водой, доведите до кипения и снимите пену.", `Добавьте лук и ${v.ingredient || "овощи"}.`, "Варите на слабом огне до готовности курицы и добавки, посолите в конце."],
  },
  {
    id: "vegetable-soup", subtitle: "Суп без мяса из запасов", flag: "🥕", course: "суп", minutes: 40, equipment: ["Кастрюля"],
    baseIngredients: [ingredient("репчатый лук", 100, "г"), ingredient("морковь", 120, "г"), ingredient("вода", 1300, "мл", { pantry: true })], pantry: [pantry("соль"), pantry("растительное масло", 10, "мл")], nutrition: { calories: 220, protein: 7, fat: 7, carbs: 32 },
    variants: [
      { id: "potato", title: "Простой картофельный суп", ingredient: "картофель", amount: 500, unit: "г", calories: 170 },
      { id: "lentil", title: "Овощной суп с чечевицей", ingredient: "чечевица", amount: 160, unit: "г", calories: 180 },
      { id: "bean", title: "Овощной суп с фасолью", ingredient: "фасоль", amount: 220, unit: "г", calories: 170 },
      { id: "cabbage", title: "Овощной суп с капустой", ingredient: "капуста", amount: 400, unit: "г" },
      { id: "mushroom", title: "Простой грибной суп", ingredient: "грибы", amount: 300, unit: "г" },
      { id: "tomato", title: "Простой томатный суп", ingredient: "помидоры", amount: 500, unit: "г" },
    ],
    steps: (v) => ["Мелко нарежьте лук и морковь, прогрейте их с маслом на дне кастрюли.", `Добавьте ${v.ingredient}, воду и соль.`, "Варите на слабом кипении до мягкости всех продуктов."],
  },
  {
    id: "egg-salad", subtitle: "Сытный салат с варёными яйцами", flag: "🥗", course: "салат", minutes: 25, equipment: ["Кастрюля", "Нож", "Миска"],
    baseIngredients: [ingredient("яйца", 3, "шт.")], pantry: [pantry("соль"), pantry("растительное масло", 15, "мл")], nutrition: { calories: 270, protein: 18, fat: 19, carbs: 7 },
    variants: [
      { id: "cucumber", title: "Салат из яиц и огурцов", ingredient: "огурцы", amount: 250, unit: "г" },
      { id: "tomato", title: "Салат из яиц и помидоров", ingredient: "помидоры", amount: 250, unit: "г" },
      { id: "tuna", title: "Салат с яйцом и тунцом", ingredient: "тунец", amount: 150, unit: "г", protein: "рыба и морепродукты", calories: 110 },
      { id: "cheese", title: "Салат с яйцом и сыром", ingredient: "сыр", amount: 90, unit: "г", calories: 140 },
      { id: "chicken", title: "Салат с яйцом и курицей", ingredient: "курица", amount: 220, unit: "г", protein: "мясо", calories: 150 },
      { id: "corn", title: "Салат с яйцом и кукурузой", ingredient: "кукуруза", amount: 160, unit: "г", calories: 100 },
    ],
    steps: (v) => ["Сварите яйца вкрутую, охладите и нарежьте крупными кусочками.", `Подготовьте ${v.ingredient} и добавьте к яйцам.`, "Посолите, заправьте небольшим количеством масла и аккуратно перемешайте."],
  },
  {
    id: "chicken-salad", subtitle: "Домашний салат с курицей", flag: "🥗", course: "салат", protein: "мясо", minutes: 30, equipment: ["Сковорода", "Нож", "Миска"],
    baseIngredients: [ingredient("курица", 250, "г")], pantry: [pantry("соль"), pantry("растительное масло", 15, "мл")], nutrition: { calories: 330, protein: 36, fat: 16, carbs: 8 },
    variants: [
      { id: "cucumber", title: "Салат с курицей и огурцом", ingredient: "огурцы", amount: 250, unit: "г" },
      { id: "tomato", title: "Салат с курицей и помидорами", ingredient: "помидоры", amount: 250, unit: "г" },
      { id: "potato", title: "Салат с курицей и картофелем", ingredient: "картофель", amount: 350, unit: "г", calories: 160 },
      { id: "rice", title: "Салат с курицей и рисом", ingredient: "рис", amount: 120, unit: "г", calories: 150 },
      { id: "cheese", title: "Салат с курицей и сыром", ingredient: "сыр", amount: 90, unit: "г", calories: 140 },
      { id: "corn", title: "Салат с курицей и кукурузой", ingredient: "кукуруза", amount: 160, unit: "г", calories: 100 },
    ],
    steps: (v) => ["Обжарьте или отварите курицу до готовности, затем немного остудите и нарежьте.", `Подготовьте ${v.ingredient} и соедините с курицей.`, "Посолите, заправьте и аккуратно перемешайте перед подачей."],
  },
  {
    id: "sandwich", subtitle: "Быстрый сэндвич без готовки на несколько часов", flag: "🥪", course: "перекус", minutes: 10, equipment: ["Нож"],
    baseIngredients: [ingredient("хлеб", 4, "ломтика")], pantry: [], nutrition: { calories: 300, protein: 10, fat: 8, carbs: 45 },
    variants: [
      { id: "cheese", title: "Сэндвич с сыром", ingredient: "сыр", amount: 90, unit: "г", calories: 140 },
      { id: "ham", title: "Сэндвич с ветчиной", ingredient: "ветчина", amount: 100, unit: "г", protein: "мясо", calories: 120 },
      { id: "tuna", title: "Сэндвич с тунцом", ingredient: "тунец", amount: 150, unit: "г", protein: "рыба и морепродукты", calories: 110 },
      { id: "chicken", title: "Сэндвич с курицей", ingredient: "курица", amount: 180, unit: "г", protein: "мясо", calories: 130 },
      { id: "egg", title: "Сэндвич с яйцом", ingredient: "яйца", amount: 2, unit: "шт.", calories: 110, equipment: ["Кастрюля", "Нож"] },
      { id: "tomato", title: "Сэндвич с помидором", ingredient: "помидоры", amount: 180, unit: "г" },
    ],
    steps: (v) => [`Подготовьте ${v.ingredient}; горячие продукты заранее приготовьте и немного остудите.`, "Разложите начинку на половине ломтиков хлеба.", "Накройте оставшимся хлебом, слегка прижмите и разрежьте пополам."],
  },
  {
    id: "cottage-cheese", subtitle: "Творожный завтрак или перекус", flag: "🥣", course: "завтрак", minutes: 8, equipment: ["Миска", "Вилка"],
    baseIngredients: [ingredient("творог", 300, "г")], pantry: [], nutrition: { calories: 300, protein: 36, fat: 14, carbs: 10 },
    variants: [
      { id: "banana", title: "Творог с бананом", ingredient: "бананы", amount: 1, unit: "шт.", calories: 90 },
      { id: "berries", title: "Творог с ягодами", ingredient: "ягоды", amount: 130, unit: "г", calories: 50 },
      { id: "honey", title: "Творог с мёдом", ingredient: "мёд", amount: 25, unit: "г", calories: 80 },
      { id: "apple", title: "Творог с яблоком", ingredient: "яблоки", amount: 1, unit: "шт.", calories: 60 },
      { id: "yogurt", title: "Творог с йогуртом", ingredient: "йогурт", amount: 120, unit: "г", calories: 80 },
      { id: "nuts", title: "Творог с орехами", ingredient: "орехи", amount: 35, unit: "г", calories: 200 },
    ],
    steps: (v) => ["Разомните творог вилкой до желаемой текстуры.", `Подготовьте ${v.ingredient} и добавьте к творогу.`, "Перемешайте или оставьте добавку сверху и сразу подавайте."],
  },
  {
    id: "lentil-bean", subtitle: "Сытное блюдо из бобовых", flag: "🫘", minutes: 35, equipment: ["Кастрюля", "Сковорода"],
    baseIngredients: [ingredient("чечевица", 180, "г"), ingredient("вода", 450, "мл", { pantry: true })], pantry: [pantry("соль"), pantry("растительное масло", 10, "мл")], nutrition: { calories: 390, protein: 22, fat: 8, carbs: 58 },
    variants: [
      { id: "tomato", title: "Чечевица с помидорами", ingredient: "помидоры", amount: 280, unit: "г" },
      { id: "rice", title: "Чечевица с рисом", ingredient: "рис", amount: 100, unit: "г", calories: 130 },
      { id: "chicken", title: "Чечевица с курицей", ingredient: "курица", amount: 230, unit: "г", protein: "мясо", calories: 160 },
      { id: "vegetables", title: "Чечевица с овощами", ingredients: [ingredient("морковь", 120, "г"), ingredient("болгарский перец", 140, "г")] },
      { id: "cheese", title: "Чечевица с сыром", ingredient: "сыр", amount: 80, unit: "г", calories: 130 },
      { id: "egg", title: "Чечевица с яйцом", ingredient: "яйца", amount: 2, unit: "шт.", calories: 110 },
    ],
    steps: (v) => ["Промойте чечевицу и варите в воде до мягкости.", `Отдельно подготовьте ${v.ingredient || "овощи"}.`, "Соедините с чечевицей, посолите и прогрейте вместе несколько минут."],
  },
  {
    id: "cabbage", subtitle: "Тушёная капуста из доступных продуктов", flag: "🥬", minutes: 40, equipment: ["Сковорода", "Кастрюля"],
    baseIngredients: [ingredient("капуста", 600, "г"), ingredient("репчатый лук", 120, "г")], pantry: [pantry("растительное масло", 15, "мл"), pantry("соль")], nutrition: { calories: 250, protein: 7, fat: 11, carbs: 30 },
    variants: [
      { id: "carrot", title: "Тушёная капуста с морковью", ingredient: "морковь", amount: 160, unit: "г" },
      { id: "chicken", title: "Тушёная капуста с курицей", ingredient: "курица", amount: 260, unit: "г", protein: "мясо", calories: 170 },
      { id: "sausage", title: "Тушёная капуста с колбасой", ingredient: "колбаса", amount: 180, unit: "г", protein: "мясо", calories: 220 },
      { id: "mushroom", title: "Тушёная капуста с грибами", ingredient: "грибы", amount: 230, unit: "г" },
      { id: "tomato", title: "Тушёная капуста с помидорами", ingredient: "помидоры", amount: 250, unit: "г" },
      { id: "potato", title: "Тушёная капуста с картофелем", ingredient: "картофель", amount: 400, unit: "г", calories: 190 },
    ],
    steps: (v) => ["Нарежьте лук и капусту, лук слегка обжарьте в масле.", `Добавьте капусту и ${v.ingredient}, перемешайте.`, "Влейте немного воды, накройте крышкой и тушите до мягкости, затем посолите."],
  },
  {
    id: "pancakes", subtitle: "Домашние оладьи на сковороде", flag: "🥞", course: "завтрак", minutes: 25, equipment: ["Сковорода", "Миска"],
    baseIngredients: [ingredient("мука", 180, "г"), ingredient("яйца", 1, "шт."), ingredient("молоко", 220, "мл")], pantry: [pantry("сахар", 20, "г"), pantry("растительное масло", 20, "мл")], nutrition: { calories: 430, protein: 14, fat: 14, carbs: 62 },
    variants: [
      { id: "apple", title: "Оладьи с яблоком", ingredient: "яблоки", amount: 1, unit: "шт.", calories: 60 },
      { id: "banana", title: "Оладьи с бананом", ingredient: "бананы", amount: 1, unit: "шт.", calories: 90 },
      { id: "cottage", title: "Оладьи с творогом", ingredient: "творог", amount: 150, unit: "г", calories: 150 },
      { id: "berries", title: "Оладьи с ягодами", ingredient: "ягоды", amount: 120, unit: "г", calories: 50 },
      { id: "cocoa", title: "Шоколадные оладьи с какао", ingredient: "какао", amount: 20, unit: "г", calories: 50 },
      { id: "cheese", title: "Несладкие оладьи с сыром", ingredient: "сыр", amount: 90, unit: "г", calories: 140 },
    ],
    steps: (v) => ["Смешайте яйцо, молоко и муку до густого однородного теста.", `Добавьте ${v.ingredient} и аккуратно перемешайте.`, "Жарьте небольшие оладьи на среднем огне по 2–3 минуты с каждой стороны."],
  },
  {
    id: "vegetable-pan", subtitle: "Овощи на одной сковороде", flag: "🥦", minutes: 25, equipment: ["Сковорода", "Нож"],
    baseIngredients: [ingredient("репчатый лук", 100, "г")], pantry: [pantry("растительное масло", 15, "мл"), pantry("соль")], nutrition: { calories: 230, protein: 6, fat: 11, carbs: 28 },
    variants: [
      { id: "zucchini", title: "Кабачки с луком на сковороде", ingredient: "кабачки", amount: 500, unit: "г" },
      { id: "eggplant", title: "Баклажаны с луком на сковороде", ingredient: "баклажаны", amount: 500, unit: "г" },
      { id: "pepper", title: "Болгарский перец с луком на сковороде", ingredient: "болгарский перец", amount: 450, unit: "г" },
      { id: "mushroom", title: "Шампиньоны с луком на сковороде", ingredient: "шампиньоны", amount: 450, unit: "г" },
      { id: "broccoli", title: "Брокколи с луком на сковороде", ingredient: "брокколи", amount: 450, unit: "г" },
      { id: "cauliflower", title: "Цветная капуста с луком на сковороде", ingredient: "цветная капуста", amount: 450, unit: "г" },
    ],
    steps: (v) => ["Нарежьте лук и основной овощ примерно одинаковыми кусочками.", "Сначала размягчите лук на среднем огне.", `Добавьте ${v.ingredient}, посолите и готовьте до мягкости и лёгкой румяности.`],
  },
  {
    id: "yogurt-bowl", subtitle: "Быстрый завтрак без плиты", flag: "🥣", course: "завтрак", minutes: 5, equipment: ["Миска", "Ложка"],
    baseIngredients: [ingredient("йогурт", 300, "г")], pantry: [], nutrition: { calories: 220, protein: 15, fat: 8, carbs: 22 },
    variants: [
      { id: "banana", title: "Йогурт с бананом", ingredient: "бананы", amount: 1, unit: "шт.", calories: 90 },
      { id: "apple", title: "Йогурт с яблоком", ingredient: "яблоки", amount: 1, unit: "шт.", calories: 60 },
      { id: "berries", title: "Йогурт с ягодами", ingredient: "ягоды", amount: 130, unit: "г", calories: 50 },
      { id: "oats", title: "Йогурт с овсяными хлопьями", ingredient: "овсяные хлопья", amount: 60, unit: "г", calories: 220 },
      { id: "nuts", title: "Йогурт с орехами", ingredient: "орехи", amount: 35, unit: "г", calories: 200 },
      { id: "honey", title: "Йогурт с мёдом", ingredient: "мёд", amount: 25, unit: "г", calories: 80 },
    ],
    steps: (v) => [`Подготовьте ${v.ingredient}: нарежьте или отмерьте нужное количество.`, "Переложите йогурт в миску.", "Добавьте выбранную добавку, перемешайте или оставьте сверху."],
  },
];

const RECIPES = FAMILIES.flatMap(family);

export const EXPANDED_HOME_RECIPE_COUNT = RECIPES.length;

export function expandedHomeRecipesForPortions(portions = 2) {
  const target = Math.min(8, Math.max(1, Number(portions) || 2));
  return RECIPES.map((recipe) => ({
    ...recipe,
    portions: target,
    ingredients: recipe.ingredients.map((item) => ({
      ...item,
      amount: displayAmount(item, target),
    })),
    source: { ...recipe.source },
  }));
}
