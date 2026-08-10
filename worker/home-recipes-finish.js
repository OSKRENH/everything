const SOURCE = {
  name: "Кутно · домашнее ядро",
  type: "kutno-home-catalog",
  note: "Редакционная домашняя рецептура Кутно для повседневной готовки.",
  url: "",
};

const DEFINITIONS = [
  {
    id: "home-tomato-cucumber-sourcream",
    title: "Салат из помидоров и огурцов со сметаной",
    subtitle: "Простой летний салат за десять минут",
    flag: "🥗",
    course: "салат",
    minutes: 10,
    equipment: ["Нож", "Миска"],
    ingredients: [
      { name: "помидоры", amount: 250, unit: "г", aliases: ["помидор", "томаты", "томат"] },
      { name: "огурцы", amount: 220, unit: "г", aliases: ["огурец", "свежие огурцы"] },
      { name: "сметана", amount: 80, unit: "г", aliases: ["сметана 15%", "сметана 20%"] },
      { name: "соль", amount: 0, unit: "", pantry: true },
    ],
    steps: [
      "Нарежьте помидоры и огурцы удобными кусочками.",
      "Добавьте сметану и щепотку соли.",
      "Аккуратно перемешайте и подавайте сразу, пока овощи не дали много сока.",
    ],
    nutrition: { calories: 150, protein: 5, fat: 9, carbs: 13 },
    tip: "Если овощи очень сочные, солите салат непосредственно перед подачей.",
  },
  {
    id: "home-tomato-cucumber-oil",
    title: "Салат из помидоров и огурцов с маслом",
    subtitle: "Базовый овощной салат без сложной заправки",
    flag: "🥗",
    course: "салат",
    minutes: 10,
    equipment: ["Нож", "Миска"],
    ingredients: [
      { name: "помидоры", amount: 250, unit: "г", aliases: ["помидор", "томаты", "томат"] },
      { name: "огурцы", amount: 220, unit: "г", aliases: ["огурец", "свежие огурцы"] },
      { name: "растительное масло", amount: 25, unit: "мл", aliases: ["масло", "подсолнечное масло"] },
      { name: "соль", amount: 0, unit: "", pantry: true },
    ],
    steps: [
      "Нарежьте помидоры и огурцы и сложите в миску.",
      "Заправьте растительным маслом и слегка посолите.",
      "Перемешайте непосредственно перед подачей.",
    ],
    nutrition: { calories: 190, protein: 3, fat: 14, carbs: 14 },
    tip: "Нерафинированное подсолнечное масло даст более выраженный вкус.",
  },
  {
    id: "home-rice-milk-porridge",
    title: "Рисовая каша на молоке",
    subtitle: "Мягкая молочная каша для завтрака",
    flag: "🥣",
    course: "завтрак",
    minutes: 35,
    equipment: ["Кастрюля"],
    ingredients: [
      { name: "рис", amount: 140, unit: "г", aliases: ["круглозёрный рис", "круглозерный рис"] },
      { name: "молоко", amount: 500, unit: "мл", aliases: ["коровье молоко"] },
      { name: "сахар", amount: 30, unit: "г", aliases: ["сахарный песок"] },
      { name: "соль", amount: 0, unit: "", pantry: true },
    ],
    steps: [
      "Промойте рис и залейте небольшим количеством воды, варите 8–10 минут до полуготовности.",
      "Влейте горячее молоко и готовьте на слабом огне, регулярно помешивая.",
      "Когда рис станет мягким, добавьте сахар и щепотку соли, прогрейте ещё 2 минуты.",
    ],
    nutrition: { calories: 420, protein: 13, fat: 9, carbs: 72 },
    tip: "После выключения дайте каше постоять под крышкой 5 минут — она станет более кремовой.",
  },
  {
    id: "home-pumpkin-rice-porridge",
    title: "Тыквенная каша с рисом на молоке",
    subtitle: "Домашняя молочная каша с тыквой",
    flag: "🎃",
    course: "завтрак",
    minutes: 45,
    equipment: ["Кастрюля", "Нож"],
    ingredients: [
      { name: "тыква", amount: 350, unit: "г", aliases: ["мякоть тыквы"] },
      { name: "рис", amount: 100, unit: "г", aliases: ["круглозёрный рис", "круглозерный рис"] },
      { name: "молоко", amount: 400, unit: "мл", aliases: ["коровье молоко"] },
      { name: "сахар", amount: 25, unit: "г", aliases: ["сахарный песок"] },
      { name: "соль", amount: 0, unit: "", pantry: true },
    ],
    steps: [
      "Нарежьте тыкву небольшими кубиками и припустите с несколькими ложками воды до мягкости.",
      "Добавьте промытый рис и молоко, доведите до слабого кипения.",
      "Варите под крышкой до мягкости риса, затем добавьте сахар и щепотку соли.",
    ],
    nutrition: { calories: 390, protein: 12, fat: 8, carbs: 70 },
    tip: "Часть готовой тыквы можно размять ложкой, чтобы каша стала однороднее.",
  },
  {
    id: "home-carrot-apple-salad",
    title: "Морковно-яблочный салат",
    subtitle: "Хрустящий сладкий салат из двух основных продуктов",
    flag: "🥕",
    course: "салат",
    minutes: 10,
    equipment: ["Тёрка", "Миска"],
    ingredients: [
      { name: "морковь", amount: 200, unit: "г", aliases: ["морковка"] },
      { name: "яблоки", amount: 200, unit: "г", aliases: ["яблоко"] },
      { name: "сахар", amount: 15, unit: "г", aliases: ["сахарный песок"] },
    ],
    steps: [
      "Очистите морковь, яблоко при желании оставьте с кожицей.",
      "Натрите морковь и яблоко на крупной тёрке.",
      "Добавьте сахар, перемешайте и оставьте на 3–5 минут, чтобы появился сок.",
    ],
    nutrition: { calories: 160, protein: 2, fat: 1, carbs: 38 },
    tip: "Если яблоко сладкое, сахар можно уменьшить или не добавлять совсем.",
  },
  {
    id: "home-boiled-dumplings-sourcream",
    title: "Отварные пельмени со сметаной",
    subtitle: "Самый простой способ приготовить пельмени",
    flag: "🥟",
    course: "основное",
    protein: "мясо",
    minutes: 15,
    equipment: ["Кастрюля", "Шумовка"],
    ingredients: [
      { name: "пельмени", amount: 500, unit: "г", aliases: ["замороженные пельмени", "пельмени замороженные"] },
      { name: "сметана", amount: 100, unit: "г", aliases: ["сметана 15%", "сметана 20%"] },
      { name: "вода", amount: 1500, unit: "мл", pantry: true },
      { name: "соль", amount: 0, unit: "", pantry: true },
    ],
    steps: [
      "Доведите воду до активного кипения и посолите.",
      "Опустите пельмени в воду, аккуратно перемешайте и после всплытия варите до готовности по размеру пельменей, обычно 5–7 минут.",
      "Достаньте шумовкой и подавайте горячими со сметаной.",
    ],
    nutrition: { calories: 720, protein: 28, fat: 34, carbs: 75 },
    tip: "Не перегружайте небольшую кастрюлю: пельмени должны свободно двигаться в воде.",
  },
  {
    id: "home-honey-soy-chicken-wings",
    title: "Куриные крылья в медово-соевом соусе",
    subtitle: "Крылья с простой сладко-солёной глазировкой",
    flag: "🍗",
    course: "основное",
    protein: "мясо",
    minutes: 50,
    equipment: ["Духовка", "Миска", "Противень"],
    ingredients: [
      { name: "куриные крылья", amount: 700, unit: "г", aliases: ["куриные крылышки", "крылья", "крылышки"] },
      { name: "мёд", amount: 40, unit: "г", aliases: ["мед"] },
      { name: "соевый соус", amount: 60, unit: "мл", aliases: ["соевый", "соус соевый"] },
      { name: "чеснок", amount: 2, unit: "зубч.", aliases: ["зубчики чеснока"], role: "optional" },
    ],
    steps: [
      "Смешайте мёд и соевый соус; при желании добавьте измельчённый чеснок.",
      "Перемешайте крылья с маринадом и оставьте минимум на 15 минут.",
      "Разложите на противне и запекайте при 200 °C около 30–35 минут, один раз перевернув и смазав оставшимся соусом.",
    ],
    nutrition: { calories: 780, protein: 55, fat: 42, carbs: 42 },
    tip: "Следите за глазировкой в конце: мёд быстро карамелизуется и может подгореть.",
  },
];

function displayAmount(item, portions) {
  if (item.pantry === true && Number(item.amount) === 0) return "по вкусу";
  const value = Number(item.amount) * portions / 2;
  const unit = String(item.unit || "").trim();
  let rounded = value;
  if (["г", "мл"].includes(unit)) rounded = Math.max(5, Math.round(value / 5) * 5);
  else if (/^(?:шт\.?|зубч\.?|гол\.?)$/i.test(unit)) rounded = Math.max(1, Math.ceil(value));
  else rounded = Math.max(0.25, Math.round(value * 4) / 4);
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${text} ${unit}`.trim();
}

export const FINISH_HOME_RECIPE_COUNT = DEFINITIONS.length;

export function finishHomeRecipesForPortions(portions = 2) {
  const target = Math.min(8, Math.max(1, Number(portions) || 2));
  return DEFINITIONS.map((recipe) => ({
    ...recipe,
    difficulty: "легко",
    servings: 2,
    portions: target,
    ingredients: recipe.ingredients.map((item) => ({
      ...item,
      amount: displayAmount(item, target),
    })),
    source: { ...SOURCE, id: recipe.id },
    why: "Простой домашний рецепт из продуктов, которые уже есть.",
  }));
}
