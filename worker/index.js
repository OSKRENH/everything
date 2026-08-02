import { createRemoteJWKSet, jwtVerify } from "jose";
import { CATALOG_VERSION, INGREDIENT_GLOSSARY, WORLD_RECIPE_CATALOG } from "./recipe-catalog.js";

const MODEL = "@cf/openai/gpt-oss-120b";
const FALLBACK_MODEL = "@cf/openai/gpt-oss-20b";
const MAX_RECIPE_GENERATION_ATTEMPTS = 3;
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const recipeSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          minutes: { type: "integer" },
          difficulty: { type: "string" },
          match: { type: "integer" },
          missing: { type: "array", items: { type: "string" } },
          uses: { type: "array", items: { type: "string" } },
          equipment: { type: "array", items: { type: "string" } },
          why: { type: "string" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                amount: {
                  type: "string",
                  description: "Конкретное количество на указанное число порций: граммы, миллилитры, чайные/столовые ложки или штуки. Никогда не писать unit.",
                },
              },
              required: ["name", "amount"],
            },
          },
          steps: { type: "array", minItems: 3, items: { type: "string" } },
          nutrition: {
            type: "object",
            properties: {
              calories: { type: "integer", minimum: 1 },
              protein: { type: "number", minimum: 0 },
              fat: { type: "number", minimum: 0 },
              carbs: { type: "number", minimum: 0 },
            },
            required: ["calories", "protein", "fat", "carbs"],
          },
          tip: { type: "string" },
        },
        required: ["title", "subtitle", "minutes", "difficulty", "match", "missing", "uses", "equipment", "why", "ingredients", "steps", "nutrition", "tip"],
      },
    },
  },
  required: ["recipes"],
};

function recipeSchemaFor(ingredients) {
  const schema = structuredClone(recipeSchema);
  const recipe = schema.properties.recipes.items;
  const allowedIngredients = [...new Set([...ingredients, "соль", "вода", "растительное масло"])];
  recipe.properties.ingredients.items.properties.name = {
    type: "string",
    enum: allowedIngredients,
  };
  recipe.properties.uses.items = {
    type: "string",
    enum: ingredients,
  };
  recipe.properties.missing = {
    type: "array",
    maxItems: 0,
    items: { type: "string" },
  };
  return schema;
}

function generatedRecipeSchemaFor(ingredients) {
  const schema = recipeSchemaFor(ingredients);
  schema.properties.recipes.minItems = 1;
  return schema;
}

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function sanitizeList(value, max = 40, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, max);
}

function parseAiResult(result) {
  const value = result?.response
    ?? result?.output_text
    ?? result?.choices?.[0]?.message?.content
    ?? result;
  if (typeof value === "object" && value) return value;
  if (typeof value !== "string") throw new Error("Unexpected AI response");
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

async function runStructuredAi(env, { messages, schema, schemaName, maxTokens, temperature }) {
  const options = {
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        schema,
      },
    },
    max_tokens: maxTokens,
    reasoning_effort: "medium",
    temperature,
  };
  try {
    return await env.AI.run(MODEL, options);
  } catch (error) {
    console.warn("primary_ai_failed", JSON.stringify({
      model: MODEL,
      fallbackModel: FALLBACK_MODEL,
      message: error instanceof Error ? error.message : String(error),
    }));
    return env.AI.run(FALLBACK_MODEL, options);
  }
}

const pantryBasics = ["соль", "вод", "масло"];

function isPantryBasic(value = "") {
  const normalized = value.toLowerCase().replace(/ё/g, "е");
  return pantryBasics.some((item) => normalized.includes(item));
}

function russianStem(value = "") {
  const normalized = String(value).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]/g, "");
  if (normalized.length <= 3) return normalized;
  return normalized.replace(/(?:иями|ями|ами|его|ого|ему|ому|ыми|ими|ой|ый|ий|ая|яя|ое|ее|ые|ие|ую|юю|ов|ев|ам|ям|ах|ях|ом|ем|у|ю|а|я|ы|и|е|о)$/u, "");
}

function ingredientMentioned(text = "", ingredient = "") {
  const words = String(text).toLowerCase().replace(/ё/g, "е").split(/[^а-яa-z0-9]+/u).map(russianStem).filter(Boolean);
  const needles = String(ingredient).toLowerCase().replace(/ё/g, "е").split(/[^а-яa-z0-9]+/u).map(russianStem).filter((word) => word.length >= 2);
  if (!needles.length) return false;
  return needles.every((needle) => words.some((word) => word === needle
    || (needle.length >= 4 && word.length >= 4 && (word.startsWith(needle) || needle.startsWith(word)))));
}

function normalizeDifficulty(value = "", fallback = "легко") {
  const normalized = String(value).toLowerCase().replace(/ё/g, "е").trim();
  if (/слож|труд|hard/.test(normalized)) return "сложно";
  if (/обыч|сред|medium|normal/.test(normalized)) return "обычно";
  if (/лег|прост|easy/.test(normalized)) return "легко";
  return fallback;
}

function difficultyRank(value) {
  return { "легко": 0, "обычно": 1, "сложно": 2 }[normalizeDifficulty(value)] ?? 0;
}

function normalizedSignature(value = "") {
  return String(value).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/gu, " ").trim();
}

const RECIPE_TITLE_FILLER_WORDS = new Set([
  "а", "без", "в", "для", "и", "из", "на", "от", "по", "под", "с", "со",
  "быстрая", "быстрое", "быстрые", "быстрый",
  "домашняя", "домашнее", "домашние", "домашний",
  "классическая", "классическое", "классические", "классический",
  "китайская", "китайское", "китайские", "китайский",
  "простая", "простое", "простые", "простой",
  "традиционная", "традиционное", "традиционные", "традиционный",
]);

function recipeTitleTokens(value = "") {
  return normalizedSignature(value).split(" ")
    .filter((word) => word && !RECIPE_TITLE_FILLER_WORDS.has(word))
    .map(russianStem)
    .filter((word) => word.length >= 2);
}

export function recipeTitlesAreDuplicate(firstTitle = "", secondTitle = "") {
  const firstSignature = normalizedSignature(firstTitle);
  const secondSignature = normalizedSignature(secondTitle);
  if (!firstSignature || !secondSignature) return false;
  if (firstSignature === secondSignature) return true;

  const first = [...new Set(recipeTitleTokens(firstTitle))];
  const second = [...new Set(recipeTitleTokens(secondTitle))];
  if (!first.length || !second.length) return false;
  if (first.join(" ") === second.join(" ")) return true;

  const secondSet = new Set(second);
  const shared = first.filter((token) => secondSet.has(token)).length;
  const shorter = Math.min(first.length, second.length);
  const union = new Set([...first, ...second]).size;
  return shorter >= 2 && shared / shorter >= 0.85 && shared / union >= 0.65;
}

function mergeUniqueRecipes(...groups) {
  const unique = [];
  for (const recipe of groups.flat()) {
    if (!recipe?.title || unique.some((existing) => recipeTitlesAreDuplicate(existing.title, recipe.title))) continue;
    unique.push(recipe);
    if (unique.length === 3) break;
  }
  return unique;
}

function ingredientIsOwned(value = "", ownedIngredients = []) {
  const normalized = value.toLowerCase().replace(/ё/g, "е");
  if (isPantryBasic(normalized)) return true;
  return ownedIngredients.some((item) => {
    const owned = item.toLowerCase().replace(/ё/g, "е");
    return normalized.includes(owned) || owned.includes(normalized);
  });
}

function fallbackAmount(name = "", portions = 2) {
  const value = name.toLowerCase().replace(/ё/g, "е");
  if (value.includes("вод")) return `${portions * 250} мл`;
  if (value.includes("масл")) return `${Math.max(1, portions)} ст. л.`;
  if (value.includes("сол")) return "по вкусу";
  if (value.includes("соус")) return `${Math.max(1, portions)} ст. л.`;
  if (value.includes("яйц")) return `${Math.max(2, portions)} шт.`;
  if (value.includes("лук") || value.includes("помидор") || value.includes("картоф")) return `${Math.max(1, Math.ceil(portions / 2))} шт.`;
  if (value.includes("рис") || value.includes("греч") || value.includes("макарон") || value.includes("паст")) return `${portions * 90} г`;
  if (value.includes("куриц") || value.includes("мяс") || value.includes("рыб")) return `${portions * 160} г`;
  if (isPantryBasic(value) || value.includes("специ")) return "по вкусу";
  return `${portions * 100} г`;
}

function normalizePortionAmount(name = "", amount = "", portions = 1) {
  const ingredient = name.toLowerCase().replace(/ё/g, "е");
  const text = String(amount).trim();
  if (/сол/.test(ingredient)) return "по вкусу";
  const match = text.replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(кг|г|мл|л|шт\.?|ст\.?\s*л\.?|ч\.?\s*л\.?)$/iu);
  if (!match) return text;
  let value = Number(match[1]);
  let unit = match[2].toLowerCase().replace(/\s+/g, " ");
  const count = Math.max(1, Number(portions) || 1);
  if (unit === "кг") {
    value *= 1000;
    unit = "г";
  }
  if (unit === "л") {
    value *= 1000;
    unit = "мл";
  }

  if (unit === "г") {
    let cap = 250 * count;
    if (/куриц|индей|мяс|говяд|свинин|рыб|фарш/.test(ingredient)) cap = 180 * count;
    else if (/рис|греч|круп|макарон|паст|овсян|булгур|кус-?кус/.test(ingredient)) cap = 100 * count;
    else if (/сыр/.test(ingredient)) cap = 60 * count;
    else if (/масл/.test(ingredient)) cap = 20 * count;
    value = Math.min(value, cap);
    return `${Math.max(5, Math.round(value / 5) * 5)} г`;
  }
  if (unit === "мл") {
    let cap = 500 * count;
    if (/соус/.test(ingredient)) cap = 30 * count;
    else if (/масл/.test(ingredient)) cap = 15 * count;
    value = Math.min(value, cap);
    return `${Math.max(5, Math.round(value / 5) * 5)} мл`;
  }
  if (/^шт/.test(unit)) {
    if (/яйц/.test(ingredient)) value = Math.min(value, 3 * count);
    else if (/лук/.test(ingredient)) value = Math.min(value, 1 * count);
    return `${Math.max(1, Math.round(value))} шт.`;
  }
  if (/^ст/.test(unit)) {
    if (/соус/.test(ingredient)) value = Math.min(value, 2 * count);
    else if (/масл/.test(ingredient)) value = Math.min(value, 1.5 * count);
    return `${Math.max(0.5, Math.round(value * 2) / 2)} ст. л.`;
  }
  if (/^ч/.test(unit)) return `${Math.max(0.5, Math.round(value * 2) / 2)} ч. л.`;
  return text;
}

function safeNutrition(value) {
  const number = (input, max) => Math.min(max, Math.max(0, Number(input) || 0));
  const nutrition = {
    calories: Math.round(number(value?.calories, 3000)),
    protein: Math.round(number(value?.protein, 300) * 10) / 10,
    fat: Math.round(number(value?.fat, 300) * 10) / 10,
    carbs: Math.round(number(value?.carbs, 600) * 10) / 10,
    estimated: value?.estimated !== false,
  };
  return nutrition.calories > 0 ? nutrition : null;
}

function cleanRecipeSteps(value) {
  const placeholders = /^(?:(?:sub)?title|description|step\s*\d*|шаг\s*\d*|null|undefined)$/i;
  const seen = new Set();
  return sanitizeList(value, 12, 400)
    .filter((step) => !placeholders.test(step.trim()))
    .filter((step) => step.length >= 12)
    .filter((step) => {
      const signature = step.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/gu, " ").trim();
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

const STEP_ACTION = /(?:очист|нареж|пореж|измельч|натер|натр|разбей|взбей|смеш|перемеш|соедин|вылож|полож|добав|перелож|помест|опуст|засып|всып|влей|налей|залей|разогр|прогр|подогр|обжар|подрумян|жар|свар|вар|туш|томи|запек|выпек|готов|кипят|довед|расплав|накрой|остав|сним|пода|посол|поперч|приправ|остуд|процед|промой|замоч|обсуш|слей|откин|распредел|сформ|переверн|сдвин|верни|уменьш|увелич|разлож|посып|полей|[а-яё]{3,}(?:йте|ите|ьте))/iu;
const ACTIVE_HEAT_ACTION = /(?:обжар|жар|свар|вар|туш|запек|выпек|готов(?:ить|ьте|им|ят|ится)|кипят|довед|расплав)/iu;
const TRANSFER_ACTION = /(?:вылож|полож|добав|перелож|помест|опуст|засып|всып|влей|налей|залей|разбей|вылей)/iu;
const COOKING_TARGET = /(?:сковород|кастрюл|сотейн|противен|духовк|форм|казан|вок|мис|тарел|вод|масл)/iu;
const TIME_OR_DONENESS = /(?:\d+(?:[.,]\d+)?\s*(?:сек|мин|час)|до\s+[а-я]|пока\s+[а-я]|до\s+готовности)/iu;
const HEAT_LEVEL = /(?:слаб|средн|сильн|низк|высок|огн|температур)/iu;
const PREHEAT_ACTION = /(?:разогр|прогр|подогр)/iu;
const FINISH_ACTION = /(?:сним|пода|разлож|перелож|остуд|готов|до\s+[а-я]|пока\s+[а-я])/iu;
const FOOD_AMOUNT = /\d+(?:[.,]\d+)?\s*(?:кг|г|мл|л|шт\.?|ст\.?\s*л\.?|ч\.?\s*л\.?)/giu;

function amountSignature(value = "") {
  return String(value)
    .toLowerCase()
    .replace(",", ".")
    .replace(/\s+/g, "")
    .replaceAll(".", "");
}

export function recipeQualityIssues(recipe, ownedIngredients) {
  const steps = cleanRecipeSteps(recipe?.steps);
  const issues = [];
  const stepText = steps.join(" ");
  const recipeIngredientNames = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((item) => String(item?.name || "").trim())
    .filter(Boolean);
  const stepMentionsIngredient = (step) => recipeIngredientNames.some((name) => ingredientMentioned(step, name));
  const isPreheatStep = (step) => PREHEAT_ACTION.test(step) && !stepMentionsIngredient(step);

  if (steps.some((step) => !STEP_ACTION.test(step))) {
    issues.push("каждый шаг должен содержать конкретное кулинарное действие");
  }

  const unusedIngredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((item) => String(item?.name || "").trim())
    .filter((name) => name && !isPantryBasic(name) && !ingredientMentioned(stepText, name));
  if (unusedIngredients.length) {
    issues.push(`в шагах не использованы ингредиенты: ${unusedIngredients.join(", ")}`);
  }

  const declaredAmounts = new Set((Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((item) => amountSignature(item?.amount))
    .filter(Boolean));
  const stepAmounts = [...stepText.matchAll(FOOD_AMOUNT)].map((match) => match[0]);
  const inconsistentAmounts = [...new Set(stepAmounts.filter((amount) => !declaredAmounts.has(amountSignature(amount))))];
  if (inconsistentAmounts.length) {
    issues.push(`количества в шагах не совпадают со списком ингредиентов: ${inconsistentAmounts.join(", ")}`);
  }

  const firstActiveHeatStep = steps.findIndex((step) => ACTIVE_HEAT_ACTION.test(step) && !isPreheatStep(step));
  if (firstActiveHeatStep >= 0) {
    const preparationChain = steps.slice(0, firstActiveHeatStep + 1);
    const transferredToCookingTarget = preparationChain.some((step) => COOKING_TARGET.test(step)
      && (TRANSFER_ACTION.test(step) || stepMentionsIngredient(step)));
    if (!transferredToCookingTarget) {
      issues.push("пропущено помещение продукта в посуду или среду приготовления перед нагревом");
    }

    const vagueHeatStep = steps.find((step) => ACTIVE_HEAT_ACTION.test(step)
      && !TIME_OR_DONENESS.test(step)
      && !(isPreheatStep(step) && HEAT_LEVEL.test(step)));
    if (vagueHeatStep) {
      issues.push("для нагрева нужно указать время или понятный признак готовности");
    }
  }

  if (steps.length && !FINISH_ACTION.test(steps.at(-1))) {
    issues.push("последний шаг должен явно завершать приготовление или подачу блюда");
  }

  const usedOwnedIngredients = ownedIngredients.filter((ingredient) => ingredientMentioned(stepText, ingredient));
  if (!usedOwnedIngredients.length) issues.push("в шагах не использован ни один продукт пользователя");

  return [...new Set(issues)];
}

function reviewRecipeQuality(recipes, ownedIngredients) {
  return recipes.map((recipe) => ({
    recipe,
    issues: recipeQualityIssues(recipe, ownedIngredients),
  }));
}

function normalizeRecipes(recipes, portions, ownedIngredients, requestedDifficulty = "") {
  const seen = new Set();
  return recipes
    .map((recipe) => {
      const steps = cleanRecipeSteps(recipe.steps);
      const recipeText = [recipe.title, recipe.subtitle, ...steps].filter(Boolean).join(" ");
      const mentionedOwned = ownedIngredients.filter((owned) => ingredientMentioned(recipeText, owned));
      let ingredients = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((item) => {
            const name = String(item?.name || "").trim();
            const amount = String(item?.amount || "").trim();
            const invalidAmount = !amount
              || /^(?:unit|units|штука|растительное масло)$/i.test(amount)
              || /[\u3400-\u9fff]/u.test(amount)
              || /^\d+(?:[.,]\d+)?$/u.test(amount);
            const cleanedAmount = invalidAmount ? fallbackAmount(name, portions) : amount;
            return { name, amount: normalizePortionAmount(name, cleanedAmount, portions) };
          })
        : [];
      for (const owned of mentionedOwned) {
        if (!ingredients.some((item) => ingredientIsOwned(item.name, [owned]) && !isPantryBasic(item.name))) {
          ingredients.push({ name: owned, amount: fallbackAmount(owned, portions) });
        }
      }
      const seenIngredients = new Set();
      ingredients = ingredients.filter((item) => {
        const signature = item.name.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/gu, " ").trim();
        if (!signature || seenIngredients.has(signature)) return false;
        seenIngredients.add(signature);
        return true;
      });
      const hasUnknownIngredient = !ingredients.length || ingredients.some((item) => !ingredientIsOwned(item.name, ownedIngredients));
      const hasMissing = sanitizeList(recipe.missing).some((item) => !isPantryBasic(item));
      const nutrition = safeNutrition(recipe.nutrition);
      const title = String(recipe.title || "").trim();
      const looksGeneric = /^(?:жареные|тушеные|вареные) (?:продукты|ингредиенты|овощи)$/i.test(title);
      if (hasUnknownIngredient || hasMissing || steps.length < 3 || !nutrition || title.length < 4 || looksGeneric) return null;
      const uses = ownedIngredients
        .filter((owned) => ingredients.some((item) => !isPantryBasic(item.name) && ingredientIsOwned(item.name, [owned])))
        .sort((first, second) => Number(!ingredientMentioned(title, first)) - Number(!ingredientMentioned(title, second)));
      const difficulty = normalizeDifficulty(recipe.difficulty, requestedDifficulty || "легко");
      const signature = `${title.toLowerCase().replace(/ё/g, "е")}|${uses.slice().sort().join("|")}`;
      if (seen.has(signature)) return null;
      seen.add(signature);
      return {
        ...recipe,
        difficulty,
        match: 100,
        missing: [],
        uses,
        equipment: sanitizeList(recipe.equipment, 12),
        ingredients,
        steps,
        nutrition,
        portions,
        source: {
          name: "Кутно",
          type: "generated",
          note: "Рецепт составлен моделью и проверен по вашему списку продуктов",
        },
        why: String(recipe.why || "Все продукты для этого блюда уже есть дома"),
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

const SESSION_COOKIE = "kutno_session";
const SESSION_TTL = 60 * 60 * 24 * 30;

function bytesToBase64(bytes) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 120000 },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function safeEqual(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}

async function ensureDatabase(env) {
  if (!env.DB) throw new Error("Database binding is unavailable");
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        kitchen_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_accounts (
        google_sub TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS favorites (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        recipe_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (id, user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS google_accounts_user_id ON google_accounts(user_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS favorites_user_id ON favorites(user_id, created_at DESC)"),
  ]);
}

async function ensureRecipeCatalog(env) {
  if (!env.DB) throw new Error("Database binding is unavailable");
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cuisine TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      recipe_json TEXT NOT NULL,
      catalog_version TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS catalog_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS recipes_cuisine ON recipes(cuisine)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS recipes_difficulty ON recipes(difficulty)"),
  ]);

  const current = await env.DB.prepare("SELECT value FROM catalog_meta WHERE key = 'recipe_catalog_version'").first();
  if (current?.value === CATALOG_VERSION) return;

  const now = Date.now();
  const statements = WORLD_RECIPE_CATALOG.map((entry) => env.DB.prepare(`
    INSERT INTO recipes (id, title, cuisine, difficulty, recipe_json, catalog_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      cuisine = excluded.cuisine,
      difficulty = excluded.difficulty,
      recipe_json = excluded.recipe_json,
      catalog_version = excluded.catalog_version,
      updated_at = excluded.updated_at
  `).bind(entry.id, entry.title, entry.cuisine, entry.difficulty, JSON.stringify(entry), CATALOG_VERSION, now));
  statements.push(env.DB.prepare(`
    INSERT INTO catalog_meta (key, value) VALUES ('recipe_catalog_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).bind(CATALOG_VERSION));
  await env.DB.batch(statements);
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function sessionCookie(token, maxAge = SESSION_TTL) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function parseKitchen(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function sanitizeKitchen(value) {
  const equipmentIds = ["pan", "pot", "oven", "blender", "microwave", "multicooker"];
  return {
    ingredients: sanitizeList(value?.ingredients),
    equipment: sanitizeList(value?.equipment, 12).filter((item) => equipmentIds.includes(item)),
    difficulty: normalizeDifficulty(value?.difficulty, "легко"),
    portions: Math.min(8, Math.max(1, Number(value?.portions) || 2)),
  };
}

async function currentSession(request, env) {
  await ensureDatabase(env);
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(`
    SELECT users.id, users.name, users.email, users.kitchen_json, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).bind(tokenHash).first();
  if (!session) return null;
  if (Number(session.expires_at) <= Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return { user: session, tokenHash };
}

async function createSession(env, user) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, user.id, Date.now() + SESSION_TTL * 1000)
    .run();
  return token;
}

async function verifyGoogleCredential(credential, clientId) {
  if (!credential || credential.length > 8192 || !clientId) throw new Error("Invalid Google credential");
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    algorithms: ["RS256"],
    clockTolerance: 5,
  });
  const email = String(payload.email || "").trim().toLowerCase().slice(0, 160);
  const name = String(payload.name || email.split("@")[0] || "Пользователь").trim().slice(0, 60);
  const googleSub = String(payload.sub || "").trim().slice(0, 255);
  if (!googleSub || !email || payload.email_verified !== true) throw new Error("Google email is not verified");
  return {
    googleSub,
    email,
    name,
    googleIsAuthoritative: email.endsWith("@gmail.com") || (payload.email_verified === true && Boolean(payload.hd)),
  };
}

async function findGoogleUser(env, googleSub) {
  return env.DB.prepare(`
    SELECT users.* FROM google_accounts
    JOIN users ON users.id = google_accounts.user_id
    WHERE google_accounts.google_sub = ?
  `).bind(googleSub).first();
}

async function createGoogleOnlyUser(env, profile) {
  const salt = new Uint8Array(16);
  const impossiblePassword = new Uint8Array(32);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(impossiblePassword);
  const user = { id: crypto.randomUUID(), name: profile.name, email: profile.email };
  await env.DB.prepare(`INSERT INTO users (id, email, name, password_hash, password_salt, kitchen_json, created_at)
    VALUES (?, ?, ?, ?, ?, '{}', ?)`)
    .bind(
      user.id,
      user.email,
      user.name,
      bytesToBase64(impossiblePassword),
      bytesToBase64(salt),
      Date.now(),
    )
    .run();
  return user;
}

async function googleLogin(request, env) {
  await ensureDatabase(env);
  const body = await request.json().catch(() => ({}));
  let profile;
  try {
    profile = await verifyGoogleCredential(String(body.credential || ""), env.GOOGLE_CLIENT_ID);
  } catch (error) {
    console.warn("google_auth_failed", error instanceof Error ? error.message : String(error));
    return json({ error: "Google не подтвердил вход. Попробуйте ещё раз." }, 401);
  }

  let user = await findGoogleUser(env, profile.googleSub);
  if (!user) {
    const existing = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(profile.email).first();
    if (existing && !profile.googleIsAuthoritative) {
      return json({ error: "Этот адрес уже связан с другим способом входа" }, 409);
    }
    user = existing || await createGoogleOnlyUser(env, profile);
    try {
      await env.DB.prepare("INSERT INTO google_accounts (google_sub, user_id, created_at) VALUES (?, ?, ?)")
        .bind(profile.googleSub, user.id, Date.now())
        .run();
    } catch {
      user = await findGoogleUser(env, profile.googleSub);
      if (!user) return json({ error: "Не получилось связать аккаунт Google" }, 409);
    }
  }

  const token = await createSession(env, user);
  return json(
    { user: publicUser(user), kitchen: parseKitchen(user.kitchen_json) },
    200,
    { "set-cookie": sessionCookie(token) },
  );
}

async function register(request, env) {
  await ensureDatabase(env);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 60);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
  const password = String(body.password || "");
  if (name.length < 2) return json({ error: "Укажите имя" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Проверьте адрес почты" }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "Пароль должен содержать от 8 до 128 символов" }, 400);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "Аккаунт с этой почтой уже существует" }, 409);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const user = { id: crypto.randomUUID(), name, email };
  const hash = await passwordHash(password, salt);
  try {
    await env.DB.prepare(`INSERT INTO users (id, email, name, password_hash, password_salt, kitchen_json, created_at)
      VALUES (?, ?, ?, ?, ?, '{}', ?)`)
      .bind(user.id, email, name, hash, bytesToBase64(salt), Date.now())
      .run();
  } catch {
    return json({ error: "Аккаунт с этой почтой уже существует" }, 409);
  }
  const token = await createSession(env, user);
  return json({ user, kitchen: {} }, 201, { "set-cookie": sessionCookie(token) });
}

async function login(request, env) {
  await ensureDatabase(env);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
  const password = String(body.password || "");
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) return json({ error: "Неверная почта или пароль" }, 401);
  const hash = await passwordHash(password, base64ToBytes(user.password_salt));
  if (!safeEqual(hash, user.password_hash)) return json({ error: "Неверная почта или пароль" }, 401);
  const token = await createSession(env, user);
  return json({ user: publicUser(user), kitchen: parseKitchen(user.kitchen_json) }, 200, { "set-cookie": sessionCookie(token) });
}

async function authMe(request, env) {
  const session = await currentSession(request, env);
  if (!session) return json({ error: "Войдите в аккаунт" }, 401);
  return json({ user: publicUser(session.user), kitchen: parseKitchen(session.user.kitchen_json) });
}

async function logout(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token && env.DB) {
    await ensureDatabase(env);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function saveKitchen(request, env) {
  const session = await currentSession(request, env);
  if (!session) return json({ error: "Войдите в аккаунт" }, 401);
  const body = await request.json().catch(() => ({}));
  const kitchen = sanitizeKitchen(body);
  await env.DB.prepare("UPDATE users SET kitchen_json = ? WHERE id = ?")
    .bind(JSON.stringify(kitchen), session.user.id)
    .run();
  return json({ ok: true, kitchen });
}

function stableRecipeId(recipe) {
  const signature = [
    String(recipe?.title || "").trim().toLowerCase().replace(/ё/g, "е"),
    ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
      .map((item) => String(item?.name || "").trim().toLowerCase().replace(/ё/g, "е"))
      .sort(),
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `r-${(hash >>> 0).toString(36)}`;
}

function sanitizeFavoriteRecipe(value) {
  const ingredients = Array.isArray(value?.ingredients)
    ? value.ingredients.slice(0, 30).map((item) => ({
        name: String(item?.name || "").trim().slice(0, 100),
        amount: String(item?.amount || "").trim().slice(0, 60),
        ...(item?.info && typeof item.info === "object" ? { info: {
          description: String(item.info.description || "").trim().slice(0, 500),
          substitutes: String(item.info.substitutes || "").trim().slice(0, 500),
        } } : {}),
      })).filter((item) => item.name && item.amount)
    : [];
  const steps = cleanRecipeSteps(value?.steps);
  const nutrition = safeNutrition(value?.nutrition);
  const title = String(value?.title || "").trim().slice(0, 120);
  if (!title || !ingredients.length || steps.length < 2 || !nutrition) return null;
  let sourceUrl = "";
  try {
    const candidate = new URL(String(value?.source?.url || ""));
    if (candidate.protocol === "https:") sourceUrl = candidate.toString().slice(0, 500);
  } catch {
    sourceUrl = "";
  }
  const recipe = {
    title,
    subtitle: String(value?.subtitle || "").trim().slice(0, 180),
    cuisine: String(value?.cuisine || "").trim().slice(0, 80),
    flag: String(value?.flag || "").trim().slice(0, 16),
    course: String(value?.course || "").trim().slice(0, 40),
    protein: String(value?.protein || "").trim().slice(0, 60),
    minutes: Math.min(240, Math.max(1, Number(value?.minutes) || 30)),
    portions: Math.min(8, Math.max(1, Number(value?.portions) || 2)),
    difficulty: String(value?.difficulty || "просто").trim().slice(0, 40),
    match: 100,
    missing: [],
    uses: sanitizeList(value?.uses, 30, 80),
    equipment: sanitizeList(value?.equipment, 20, 80),
    why: String(value?.why || "").trim().slice(0, 300),
    ingredients,
    steps,
    nutrition,
    tip: String(value?.tip || "").trim().slice(0, 300),
    source: {
      name: String(value?.source?.name || "Кутно").trim().slice(0, 80),
      type: String(value?.source?.type || "generated").trim().slice(0, 40),
      note: String(value?.source?.note || "").trim().slice(0, 200),
      url: sourceUrl,
    },
  };
  return { id: stableRecipeId(recipe), ...recipe };
}

async function listFavorites(request, env) {
  const session = await currentSession(request, env);
  if (!session) return json({ error: "Войдите в аккаунт" }, 401);
  const result = await env.DB.prepare(`
    SELECT recipe_json FROM favorites
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
  `).bind(session.user.id).all();
  const favorites = result.results.map((row) => {
    try {
      return JSON.parse(row.recipe_json);
    } catch {
      return null;
    }
  }).filter(Boolean);
  return json({ favorites });
}

async function saveFavorite(request, env) {
  const session = await currentSession(request, env);
  if (!session) return json({ error: "Войдите в аккаунт" }, 401);
  const body = await request.json().catch(() => ({}));
  const recipe = sanitizeFavoriteRecipe(body.recipe);
  if (!recipe) return json({ error: "Некорректный рецепт" }, 400);
  await env.DB.prepare(`
    INSERT INTO favorites (id, user_id, recipe_json, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET recipe_json = excluded.recipe_json, created_at = excluded.created_at
  `).bind(recipe.id, session.user.id, JSON.stringify(recipe), Date.now()).run();
  return json({ favorite: recipe }, 201);
}

async function deleteFavorite(request, env, id) {
  const session = await currentSession(request, env);
  if (!session) return json({ error: "Войдите в аккаунт" }, 401);
  await env.DB.prepare("DELETE FROM favorites WHERE id = ? AND user_id = ?")
    .bind(String(id || "").slice(0, 80), session.user.id)
    .run();
  return json({ ok: true });
}

function spoonacularKey(env) {
  return env.SPOONACULAR_API_KEY || env.SPOONACULAR_KEY || env.SPOONACULAR_API || "";
}

function catalogIngredientMatches(item, ownedIngredient) {
  const candidates = [item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])].filter(Boolean);
  return candidates.some((candidate) => ingredientMentioned(candidate, ownedIngredient)
    || ingredientMentioned(ownedIngredient, candidate)
    || normalizedSignature(candidate).includes(normalizedSignature(ownedIngredient))
    || normalizedSignature(ownedIngredient).includes(normalizedSignature(candidate)));
}

function catalogRecipeIsAvailable(recipe, ownedIngredients, equipment) {
  const requiredIngredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const requiredEquipment = Array.isArray(recipe?.equipment) ? recipe.equipment : [];
  return requiredIngredients.every((item) => item?.pantry === true
      || ownedIngredients.some((owned) => catalogIngredientMatches(item, owned)))
    && requiredEquipment.every((required) => equipment.some((owned) => normalizedSignature(owned) === normalizedSignature(required)));
}

function scaledCatalogAmount(item, portions, baseServings) {
  if (typeof item?.amount !== "number") return String(item?.amount || "по вкусу");
  const value = item.amount * portions / Math.max(1, Number(baseServings) || portions);
  const unit = String(item.unit || "").trim();
  let rounded = value;
  if (unit === "г" || unit === "мл") rounded = Math.max(1, Math.round(value / 5) * 5);
  else if (unit === "шт." || unit === "зубч." || unit === "гол." || unit === "пал.") rounded = Math.max(0.25, Math.round(value * 4) / 4);
  else rounded = Math.max(0.25, Math.round(value * 4) / 4);
  const displayed = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${displayed} ${unit}`.trim();
}

function catalogRecipeForPortions(recipe, ownedIngredients, portions) {
  const uses = ownedIngredients.filter((owned) => recipe.ingredients.some((item) => !item.pantry && catalogIngredientMatches(item, owned)));
  return {
    id: `catalog:${recipe.id}`,
    title: recipe.title,
    subtitle: recipe.subtitle,
    cuisine: recipe.cuisine,
    flag: recipe.flag || "🌍",
    course: recipe.course || "основное",
    protein: recipe.protein || "без мяса",
    minutes: Number(recipe.minutes) || 30,
    difficulty: normalizeDifficulty(recipe.difficulty),
    match: 100,
    missing: [],
    uses,
    equipment: recipe.equipment,
    why: `Все обязательные продукты для классического блюда уже есть дома`,
    ingredients: recipe.ingredients.map((item) => {
      const itemSignature = normalizedSignature(item.name);
      const glossaryEntry = Object.entries(INGREDIENT_GLOSSARY).find(([name]) => {
        const glossarySignature = normalizedSignature(name);
        return itemSignature === glossarySignature
          || itemSignature.includes(glossarySignature)
          || (itemSignature.length >= 8 && glossarySignature.includes(itemSignature));
      })?.[1];
      return {
        name: item.name,
        amount: scaledCatalogAmount(item, portions, recipe.servings),
        ...(glossaryEntry ? { info: glossaryEntry } : {}),
      };
    }),
    steps: cleanRecipeSteps(recipe.steps),
    nutrition: { ...safeNutrition(recipe.nutrition), estimated: true },
    tip: String(recipe.tip || ""),
    portions,
    source: {
      id: `catalog:${recipe.id}`,
      name: recipe.source?.name || "Кутно · мировая классика",
      type: "kutno-catalog",
      note: recipe.source?.note || "Редакционная версия традиционной рецептуры",
      url: /^https:\/\//i.test(recipe.source?.url || "") ? recipe.source.url : "",
      license: String(recipe.source?.license || ""),
    },
  };
}

async function findCatalogRecipes(env, { ingredients, equipment, difficulty, portions, excludeTitles, variation }) {
  await ensureRecipeCatalog(env);
  const result = await env.DB.prepare(`
    SELECT recipe_json FROM recipes
    WHERE catalog_version = ?
    ORDER BY CASE WHEN cuisine = 'Россия' THEN 0 ELSE 1 END, cuisine, title
    LIMIT 250
  `).bind(CATALOG_VERSION).all();
  const recipes = result.results.map((row) => {
    try {
      return JSON.parse(row.recipe_json);
    } catch {
      return null;
    }
  }).filter(Boolean)
    .filter((recipe) => !excludeTitles.some((title) => recipeTitlesAreDuplicate(title, recipe.title)))
    .filter((recipe) => catalogRecipeIsAvailable(recipe, ingredients, equipment))
    .map((recipe) => ({
      recipe,
      difficultyDistance: Math.abs(difficultyRank(recipe.difficulty) - difficultyRank(difficulty)),
      usedCount: ingredients.filter((owned) => recipe.ingredients.some((item) => !item.pantry && catalogIngredientMatches(item, owned))).length,
      rotation: Math.abs(hashText(`${recipe.id}:${variation}`)) % 1000,
    }))
    .sort((first, second) => first.difficultyDistance - second.difficultyDistance
      || second.usedCount - first.usedCount
      || first.rotation - second.rotation)
    .map(({ recipe }) => catalogRecipeForPortions(recipe, ingredients, portions));
  return mergeUniqueRecipes(recipes);
}

async function listRecipeCatalog(request, env) {
  await ensureRecipeCatalog(env);
  const url = new URL(request.url);
  const portions = Math.min(8, Math.max(1, Number(url.searchParams.get("portions")) || 2));
  const result = await env.DB.prepare(`
    SELECT recipe_json FROM recipes
    WHERE catalog_version = ?
    ORDER BY CASE WHEN cuisine = 'Россия' THEN 0 ELSE 1 END, cuisine, title
    LIMIT 250
  `).bind(CATALOG_VERSION).all();
  const recipes = result.results.map((row) => {
    try {
      const recipe = JSON.parse(row.recipe_json);
      return {
        ...catalogRecipeForPortions(recipe, [], portions),
        match: null,
        why: `Классическое блюдо кухни: ${recipe.cuisine}`,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
  return json({ recipes, catalogVersion: CATALOG_VERSION, total: recipes.length });
}

function hashText(value = "") {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

function isAllowedSourcePantryItem(value = "") {
  const normalized = String(value).toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
  return /^(?:sea )?salt$/.test(normalized)
    || /^(?:cold |hot |warm |boiling )?water$/.test(normalized)
    || normalized === "oil"
    || /^(?:(?:extra virgin )?olive|vegetable|sunflower|cooking|neutral) oil$/.test(normalized);
}

function normalizeEnglishIngredient(value = "") {
  return String(value).toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim()
    .split(/[\s-]+/)
    .map((word) => word.length > 4 && word.endsWith("es") ? word.slice(0, -2) : word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word)
    .join(" ");
}

function englishIngredientIsOwned(value, translations) {
  if (isAllowedSourcePantryItem(value)) return true;
  const normalized = normalizeEnglishIngredient(value);
  return translations.some((item) => {
    const translated = normalizeEnglishIngredient(item.english);
    if (!translated) return false;
    return normalized.includes(translated) || translated.includes(normalized)
      || translated.split(" ").every((token) => normalized.split(" ").includes(token));
  });
}

function originalIngredientForEnglish(value, translations) {
  const normalized = normalizeEnglishIngredient(value);
  if (/salt/.test(normalized)) return "соль";
  if (/water/.test(normalized)) return "вода";
  if (/oil/.test(normalized)) return "растительное масло";
  const ranked = translations.map((item) => {
    const translated = normalizeEnglishIngredient(item.english);
    const exact = normalized === translated ? 0 : normalized.includes(translated) || translated.includes(normalized) ? 1 : 2;
    const shared = translated.split(" ").filter((token) => normalized.split(" ").includes(token)).length;
    return { original: item.original, score: exact * 100 - shared * 10 + Math.abs(normalized.length - translated.length) };
  }).sort((first, second) => first.score - second.score);
  return ranked[0]?.score < 200 ? ranked[0].original : "";
}

function displaySourceAmount(item, portions, sourceServings, originalName) {
  const factor = portions / Math.max(1, Number(sourceServings) || portions);
  let amount = Math.max(0, Number(item?.amount) || 0) * factor;
  const unit = String(item?.unit || "").toLowerCase().replaceAll(".", "").trim();
  const englishName = normalizeEnglishIngredient(item?.name);
  const rounded = (value, precision = 1) => {
    const multiplier = 10 ** precision;
    return Math.round(value * multiplier) / multiplier;
  };

  if (["kg", "kilogram", "kilograms"].includes(unit)) return `${Math.round(amount * 1000)} г`;
  if (["g", "gram", "grams"].includes(unit)) return `${Math.max(1, Math.round(amount))} г`;
  if (["oz", "ounce", "ounces"].includes(unit)) return `${Math.max(1, Math.round(amount * 28.35))} г`;
  if (["lb", "lbs", "pound", "pounds"].includes(unit)) return `${Math.max(1, Math.round(amount * 453.6))} г`;
  if (["l", "liter", "liters", "litre", "litres"].includes(unit)) return `${Math.max(1, Math.round(amount * 1000))} мл`;
  if (["ml", "milliliter", "milliliters"].includes(unit)) return `${Math.max(1, Math.round(amount))} мл`;
  if (["tablespoon", "tablespoons", "tbsp", "tbsps"].includes(unit)) return `${Math.max(0.5, rounded(amount, 1))} ст. л.`;
  if (["teaspoon", "teaspoons", "tsp", "tsps"].includes(unit)) return `${Math.max(0.5, rounded(amount, 1))} ч. л.`;
  if (["cup", "cups"].includes(unit)) {
    if (/sauce|oil|water|milk|broth|juice/.test(englishName)) {
      let milliliters = Math.round(amount * 240);
      if (normalize(originalName).includes("соус")) milliliters = Math.min(milliliters, portions * 30);
      return `${Math.max(1, milliliters)} мл`;
    }
    const gramsPerCup = /rice|grain|flour|oat/.test(englishName) ? 185 : 150;
    return `${Math.max(1, Math.round(amount * gramsPerCup))} г`;
  }

  if (/egg/.test(englishName)) amount = Math.min(amount, portions * 3);
  if (/garlic/.test(englishName)) amount = Math.min(amount, portions * 2);
  if (amount > 0) return `${Math.max(0.5, rounded(amount * 2, 0) / 2)} шт.`;
  return fallbackAmount(originalName, portions);
}

function sourcedIngredientsForPortions(recipe, translations, portions) {
  const seen = new Set();
  return (Array.isArray(recipe?.extendedIngredients) ? recipe.extendedIngredients : [])
    .filter((item) => englishIngredientIsOwned(item.nameClean || item.name, translations))
    .map((item) => {
      const name = originalIngredientForEnglish(item.nameClean || item.name, translations);
      return name ? {
        name,
        amount: displaySourceAmount(item, portions, recipe.servings, name),
        englishName: String(item.nameClean || item.name || ""),
      } : null;
    })
    .filter((item) => item && !seen.has(item.name) && seen.add(item.name))
    .slice(0, 30);
}

async function translateIngredientsForSpoonacular(env, ingredients) {
  const schema = {
    type: "object",
    properties: {
      translations: {
        type: "array",
        minItems: ingredients.length,
        maxItems: ingredients.length,
        items: {
          type: "object",
          properties: {
            original: { type: "string", enum: ingredients },
            english: { type: "string" },
          },
          required: ["original", "english"],
        },
      },
    },
    required: ["translations"],
  };
  const result = await runStructuredAi(env, {
    messages: [
      { role: "system", content: "Переведи названия продуктов с русского на простой английский для поиска в кулинарной базе. Не добавляй пояснения, бренды или количество. Сохрани каждое исходное название в original." },
      { role: "user", content: ingredients.join("\n") },
    ],
    schema,
    schemaName: "ingredient_translations",
    maxTokens: 700,
    temperature: 0,
  });
  const data = parseAiResult(result);
  const translations = Array.isArray(data.translations) ? data.translations : [];
  const byOriginal = new Map(translations.map((item) => [String(item?.original || ""), String(item?.english || "").trim()]));
  return ingredients.map((original) => ({ original, english: byOriginal.get(original) || original })).filter((item) => item.english);
}

function sourceNutrition(recipe) {
  const nutrients = Array.isArray(recipe?.nutrition?.nutrients) ? recipe.nutrition.nutrients : [];
  const amount = (name) => Number(nutrients.find((item) => String(item?.name || "").toLowerCase() === name)?.amount) || 0;
  const nutrition = {
    calories: Math.round(amount("calories")),
    protein: Math.round(amount("protein") * 10) / 10,
    fat: Math.round(amount("fat") * 10) / 10,
    carbs: Math.round(amount("carbohydrates") * 10) / 10,
    estimated: false,
  };
  return nutrition.calories > 0 ? nutrition : null;
}

function adaptedSourceNutrition(recipe, translations, strictMatch) {
  if (strictMatch) return sourceNutrition(recipe);
  const ingredients = Array.isArray(recipe?.nutrition?.ingredients) ? recipe.nutrition.ingredients : [];
  if (!ingredients.length) return null;
  const selected = ingredients.filter((item) => englishIngredientIsOwned(item?.name, translations));
  if (!selected.length) return null;
  const nutrientAmount = (ingredient, name) => Number((Array.isArray(ingredient?.nutrients) ? ingredient.nutrients : [])
    .find((item) => String(item?.name || "").toLowerCase() === name)?.amount) || 0;
  const servings = Math.max(1, Number(recipe?.servings) || 1);
  const sum = (name) => selected.reduce((total, ingredient) => total + nutrientAmount(ingredient, name), 0) / servings;
  const nutrition = {
    calories: Math.round(sum("calories")),
    protein: Math.round(sum("protein") * 10) / 10,
    fat: Math.round(sum("fat") * 10) / 10,
    carbs: Math.round(sum("carbohydrates") * 10) / 10,
    estimated: false,
  };
  return nutrition.calories > 0 ? nutrition : null;
}

function sourceRecipeSteps(recipe) {
  const groups = Array.isArray(recipe?.analyzedInstructions) ? recipe.analyzedInstructions : [];
  return groups.flatMap((group) => Array.isArray(group?.steps) ? group.steps : [])
    .map((item) => String(item?.step || "").replace(/<[^>]*>/g, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function spoonacularRecipeSchemaFor(ingredients, sourceIndexes) {
  const schema = recipeSchemaFor(ingredients);
  const recipe = schema.properties.recipes.items;
  recipe.properties.sourceIndex = { type: "integer", enum: sourceIndexes };
  recipe.required = [...recipe.required, "sourceIndex"];
  schema.properties.recipes.maxItems = sourceIndexes.length;
  return schema;
}

function sourceDifficulty(recipe) {
  const minutes = Math.max(1, Number(recipe?.readyInMinutes) || 45);
  const stepCount = sourceRecipeSteps(recipe).length;
  const ingredientCount = Array.isArray(recipe?.extendedIngredients) ? recipe.extendedIngredients.length : 0;
  if (minutes >= 90 || stepCount >= 10 || ingredientCount >= 14) return "сложно";
  if (minutes >= 45 || stepCount >= 7 || ingredientCount >= 9) return "обычно";
  return "легко";
}

async function generateFromSpoonacular(env, { ingredients, equipment, difficulty, portions, excludedSourceIds = [] }) {
  const apiKey = spoonacularKey(env);
  if (!apiKey) return [];

  const translations = await translateIngredientsForSpoonacular(env, ingredients);
  const searchUrl = new URL("https://api.spoonacular.com/recipes/findByIngredients");
  searchUrl.searchParams.set("apiKey", apiKey);
  searchUrl.searchParams.set("ingredients", translations.map((item) => item.english).join(","));
  searchUrl.searchParams.set("number", "12");
  searchUrl.searchParams.set("ranking", "1");
  searchUrl.searchParams.set("ignorePantry", "false");
  const searchResponse = await fetch(searchUrl, { headers: { accept: "application/json" } });
  if (!searchResponse.ok) throw new Error(`Spoonacular search failed: ${searchResponse.status}`);
  const searchResults = await searchResponse.json();
  const sourceMatches = (Array.isArray(searchResults) ? searchResults : [])
    .map((item) => {
      const missed = (Array.isArray(item?.missedIngredients) ? item.missedIngredients : [])
        .filter((missing) => !isAllowedSourcePantryItem(missing?.name));
      const normalizedTitle = normalizeEnglishIngredient(item?.title);
      const missesCoreTitleIngredient = missed.some((missing) => {
        const missingName = normalizeEnglishIngredient(missing?.name);
        return missingName && (normalizedTitle.includes(missingName) || missingName.includes(normalizedTitle));
      });
      return { ...item, nonPantryMissed: missed, strictMatch: missed.length === 0, missesCoreTitleIngredient };
    })
    .filter((item) => !excludedSourceIds.includes(Number(item.id)))
    .filter((item) => (!item.missesCoreTitleIngredient || Number(item.usedIngredientCount || 0) >= 5)
      && item.nonPantryMissed.length <= 2
      && Number(item.usedIngredientCount || 0) >= 2
      && Number(item.usedIngredientCount || 0) >= item.nonPantryMissed.length * 2)
    .sort((first, second) => first.nonPantryMissed.length - second.nonPantryMissed.length
      || Number(second.usedIngredientCount || 0) - Number(first.usedIngredientCount || 0))
    .slice(0, 6);
  if (!sourceMatches.length) return [];

  const infoUrl = new URL("https://api.spoonacular.com/recipes/informationBulk");
  infoUrl.searchParams.set("apiKey", apiKey);
  infoUrl.searchParams.set("ids", sourceMatches.map((item) => item.id).join(","));
  infoUrl.searchParams.set("includeNutrition", "true");
  const infoResponse = await fetch(infoUrl, { headers: { accept: "application/json" } });
  if (!infoResponse.ok) throw new Error(`Spoonacular details failed: ${infoResponse.status}`);
  const details = await infoResponse.json();
  const candidates = (Array.isArray(details) ? details : [])
    .map((recipe) => {
      const searchMatch = sourceMatches.find((item) => Number(item.id) === Number(recipe.id));
      const sourceIngredients = sourcedIngredientsForPortions(recipe, translations, portions);
      const nutrition = sourceNutrition(recipe);
      if (nutrition && !searchMatch?.strictMatch) nutrition.estimated = true;
      return {
        id: Number(recipe.id),
        title: String(recipe.title || "").slice(0, 160),
        readyInMinutes: Number(recipe.readyInMinutes) || 45,
        difficulty: sourceDifficulty(recipe),
        servings: Number(recipe.servings) || portions,
        sourceName: String(recipe.sourceName || recipe.creditsText || "Spoonacular").slice(0, 100),
        sourceUrl: String(recipe.sourceUrl || recipe.spoonacularSourceUrl || ""),
        ingredients: sourceIngredients,
        omittedIngredients: (searchMatch?.nonPantryMissed || []).map((item) => String(item?.name || "").slice(0, 100)),
        steps: sourceRecipeSteps(recipe),
        nutrition,
      };
    })
    .filter((recipe) => recipe.title
      && recipe.ingredients.length >= 2
      && recipe.steps.length >= 3
      && recipe.nutrition)
    .sort((first, second) => Math.abs(difficultyRank(first.difficulty) - difficultyRank(difficulty))
      - Math.abs(difficultyRank(second.difficulty) - difficultyRank(difficulty)))
    .slice(0, 3)
    .map((recipe, sourceIndex) => ({ ...recipe, sourceIndex }));
  if (!candidates.length) return [];

  const result = await runStructuredAi(env, {
    messages: [
      {
        role: "system",
        content: `Ты — кулинарный переводчик и редактор. Переведи предоставленные рецепты на естественный русский язык, не меняя их основную технику. Используй только продукты пользователя плюс соль, воду и растительное масло. Названия небазовых ингредиентов в итоговом ingredients должны дословно совпадать со списком пользователя. Масштабируй количества на ${portions} порции. Не добавляй продукты, которых нет у пользователя. Поле omittedIngredients содержит отсутствующие добавки: полностью исключи их из ингредиентов и шагов. Если после их исключения блюдо теряет смысл, пропусти рецепт. Каждый sourceIndex сохрани без изменения. Сложность сохрани из исходного поля difficulty. КБЖУ скопируй из sourceNutrition без пересчёта.`,
      },
      {
        role: "user",
        content: `Продукты пользователя: ${ingredients.join(", ")}\nИнвентарь: ${equipment.join(", ") || "базовая кухня"}\nЖелаемая сложность: ${difficulty}\nИсходные рецепты:\n${JSON.stringify(candidates)}`,
      },
    ],
    schema: spoonacularRecipeSchemaFor(ingredients, candidates.map((item) => item.sourceIndex)),
    schemaName: "adapted_source_recipes",
    maxTokens: 3000,
    temperature: 0.05,
  });
  const data = parseAiResult(result);
  const normalized = normalizeRecipes(Array.isArray(data.recipes) ? data.recipes : [], portions, ingredients, difficulty)
    .filter((recipe) => recipeQualityIssues(recipe, ingredients).length === 0);
  return normalized.map((recipe) => {
    const source = candidates.find((candidate) => candidate.sourceIndex === Number(recipe.sourceIndex));
    if (!source) return null;
    return {
      ...recipe,
      minutes: Number(source.readyInMinutes) || Number(recipe.minutes) || 45,
      difficulty: source.difficulty,
      ingredients: source.ingredients.map(({ name, amount }) => ({ name, amount })),
      uses: ingredients.filter((owned) => source.ingredients.some((item) => ingredientIsOwned(item.name, [owned]))),
      nutrition: source.nutrition,
      source: {
        id: source.id,
        name: source.sourceName || "Spoonacular",
        type: "spoonacular",
        note: "Рецепт найден в кулинарной базе Spoonacular и адаптирован на русский язык",
        url: /^https:\/\//i.test(source.sourceUrl) ? source.sourceUrl : "",
      },
    };
  }).filter(Boolean).slice(0, 3);
}

async function generateRecipes(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Некорректный запрос" }, 400);
  }

  const ingredients = sanitizeList(body.ingredients);
  const equipment = sanitizeList(body.equipment, 12);
  const difficulty = normalizeDifficulty(body.difficulty, "легко");
  const portions = Math.min(8, Math.max(1, Number(body.portions) || 2));
  const excludeTitles = sanitizeList(body.excludeTitles, 12, 120);
  const excludedSourceIds = Array.isArray(body.excludeSourceIds)
    ? body.excludeSourceIds.map(Number).filter(Number.isFinite).slice(0, 20)
    : [];
  const variation = Math.min(999999, Math.max(0, Number(body.variation) || 0));
  if (!ingredients.length) return json({ error: "Добавьте хотя бы один продукт" }, 400);

  let recipes = [];
  let catalogAttempt = "no_matching_catalog_recipe";
  try {
    recipes = await findCatalogRecipes(env, { ingredients, equipment, difficulty, portions, excludeTitles, variation });
    if (recipes.length >= 3) return json({ recipes, source: "kutno-catalog", catalogVersion: CATALOG_VERSION });
  } catch (error) {
    catalogAttempt = error instanceof Error ? error.message : String(error);
    console.warn("catalog_search_failed", catalogAttempt);
  }

  let sourceAttempt = spoonacularKey(env) ? "no_matching_source_recipe" : "spoonacular_not_configured";
  if (spoonacularKey(env)) {
    try {
      const sourcedRecipes = (await generateFromSpoonacular(env, { ingredients, equipment, difficulty, portions, excludedSourceIds }))
        .filter((recipe) => !excludeTitles.some((title) => recipeTitlesAreDuplicate(title, recipe.title)));
      recipes = mergeUniqueRecipes(recipes, sourcedRecipes);
      if (recipes.length >= 3) return json({ recipes, source: "mixed", catalogVersion: CATALOG_VERSION });
    } catch (error) {
      sourceAttempt = error instanceof Error ? error.message : String(error);
      console.warn("spoonacular_generation_failed", sourceAttempt);
    }
  }

  const allExcludedTitles = [...new Set([...excludeTitles, ...recipes.map((recipe) => recipe.title)])];

  const system = `Ты — строгий редактор современной русской кулинарной книги. Предложи до трёх разных действительно существующих и кулинарно осмысленных домашних блюд, использующих разные сочетания доступных продуктов. Если исходный набор объективно позволяет приготовить только одно или два нормальных блюда, верни меньше. Не придумывай блюдо только ради заполнения списка. Пиши только по-русски, без англицизмов, заглушек, служебных слов и выдуманных техник.
ЖЁСТКОЕ ПРАВИЛО: используй только продукты из списка пользователя, а также соль, воду и растительное масло. Нельзя добавлять перец, чеснок, специи, соусы, сахар, муку, молоко, зелень или любой другой продукт, если его нет в списке. Поле missing всегда должно быть пустым массивом. В ingredients перечисли абсолютно всё, что используется в шагах; названия пользовательских продуктов сохраняй максимально близко к исходному списку. Не называй блюдо общими словами вроде «жареные продукты» или «смесь ингредиентов». В amount всегда указывай понятное русское количество: г, мл, ст. л., ч. л. или шт.; слово unit запрещено. Каждый рецепт должен содержать минимум три законченных конкретных шага с температурой или понятным уровнем огня и временем там, где это важно. Не выводи слова subtitle, title, description или step как содержимое полей. Не предлагай опасные способы приготовления.
РАЗУМНЫЕ КОЛИЧЕСТВА: сыр — не более 60 г на порцию, мясо или рыба — не более 180 г на порцию, сухая крупа или макароны — не более 100 г на порцию, масло — не более 1 ст. л. на порцию. Соль указывай только «по вкусу». Количества продуктов лучше не повторять в шагах; если повторяешь, они обязаны дословно совпадать с ingredients.
СВЯЗНОСТЬ ШАГОВ: каждый шаг должен ясно отвечать, что взять, куда поместить, что сделать и какого результата дождаться. Нельзя пропускать перенос продукта в посуду: после шага «разогреть сковороду» обязательно должен быть шаг «выложить или влить продукт на сковороду», и только затем «готовить». Не используй местоимения без понятного объекта. Последний шаг должен явно завершать приготовление или подачу. Перед ответом мысленно пройди рецепт от первого шага до последнего и исправь любой разрыв в последовательности.
Для каждого рецепта оцени КБЖУ НА ОДНУ ПОРЦИЮ по указанным количествам: calories — ккал, protein/fat/carbs — граммы. Значения должны быть реалистичными и согласованными с ингредиентами; это ориентировочная оценка.`;
  const user = `Продукты дома: ${ingredients.join(", ")}.
Инвентарь: ${equipment.length ? equipment.join(", ") : "обычная базовая кухня"}.
Желаемая сложность приготовления: ${difficulty}. Порций: ${portions}.
${allExcludedTitles.length ? `Не повторяй недавние варианты: ${allExcludedTitles.join(", ")}.` : ""}
Номер вариации запроса: ${variation}.
Никаких покупок и замен: каждый небазовый ингредиент обязан дословно соответствовать продукту из списка. Расположи блюда от самого подходящего. Количество ингредиентов укажи на ${portions} порции. В ingredients перечисли только продукты, реально участвующие в шагах, и обязательно добавь туда каждый продукт, упомянутый в шагах. match для каждого блюда — 100. В uses перечисли только использованные продукты пользователя, missing — пустой массив. Лучше вернуть один хороший узнаваемый рецепт, чем три нелепых.`;

  try {
    let retryFeedback = "";
    for (let attempt = 1; attempt <= MAX_RECIPE_GENERATION_ATTEMPTS; attempt += 1) {
      const retryInstruction = retryFeedback
        ? `\n\nПредыдущий вариант не прошёл проверку качества:\n${retryFeedback}\nПолностью перепиши проблемные рецепты и устрани все указанные разрывы. Если причина в повторе, смени одновременно главный продукт, название и технику приготовления; не переименовывай прежнее блюдо.`
        : "";
      const result = await runStructuredAi(env, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${user}${retryInstruction}` },
        ],
        schema: generatedRecipeSchemaFor(ingredients),
        schemaName: "generated_recipes",
        maxTokens: 2800,
        temperature: attempt === 1 ? 0.35 : attempt === 2 ? 0.2 : 0.65,
      });
      const data = parseAiResult(result);
      if (!Array.isArray(data.recipes) || !data.recipes.length) {
        retryFeedback = "ответ не содержит ни одного законченного рецепта";
        continue;
      }

      const normalizedGeneratedRecipes = normalizeRecipes(data.recipes, portions, ingredients, difficulty);
      const generatedRecipes = normalizedGeneratedRecipes
        .filter((recipe) => !allExcludedTitles.some((title) => recipeTitlesAreDuplicate(title, recipe.title)));
      const qualityReview = reviewRecipeQuality(generatedRecipes, ingredients);
      const coherentRecipes = qualityReview.filter(({ issues }) => issues.length === 0).map(({ recipe }) => recipe);
      const recipeCountBeforeMerge = recipes.length;
      recipes = mergeUniqueRecipes(recipes, coherentRecipes);
      if (recipes.length > recipeCountBeforeMerge) {
        return json({
          recipes,
          source: recipes.some((recipe) => recipe.source?.type === "kutno-catalog") ? "mixed" : "workers-ai",
          sourceAttempt,
          catalogAttempt,
          catalogVersion: CATALOG_VERSION,
        });
      }

      retryFeedback = normalizedGeneratedRecipes.length && !generatedRecipes.length
        ? `все предложенные блюда повторяют недавние варианты (${allExcludedTitles.join(", ")}); выбери другие блюда и другие техники приготовления`
        : qualityReview.length
        ? qualityReview.map(({ recipe, issues }) => `${recipe.title}: ${issues.join("; ")}`).join("\n")
        : "рецепты нарушают ограничения по продуктам, количествам или структуре шагов";
      console.warn("recipe_quality_retry", JSON.stringify({ attempt, retryFeedback }));
    }

    throw new Error("Recipes failed quality checks after retry");
  } catch (error) {
    console.error("recipe_generation_failed", error instanceof Error ? error.message : String(error));
    if (recipes.length) return json({ recipes, source: "mixed", sourceAttempt, catalogAttempt, catalogVersion: CATALOG_VERSION });
    return json({ error: "Не удалось составить меню" }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.kutno.ru") {
      url.hostname = "kutno.ru";
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === "/api/config" && request.method === "GET") {
      return json({ googleClientId: env.GOOGLE_CLIENT_ID });
    }

    if (url.pathname === "/api/source-status" && request.method === "GET") {
      return json({
        catalogVersion: CATALOG_VERSION,
        catalogSize: WORLD_RECIPE_CATALOG.length,
        spoonacularConfigured: Boolean(spoonacularKey(env)),
        source: "kutno-catalog",
      });
    }

    if (url.pathname === "/api/auth/google" && request.method === "POST") {
      return googleLogin(request, env);
    }

    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      return register(request, env);
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      return login(request, env);
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return logout(request, env);
    }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      return authMe(request, env);
    }

    if (url.pathname === "/api/kitchen" && request.method === "PUT") {
      return saveKitchen(request, env);
    }

    if (url.pathname === "/api/favorites" && request.method === "GET") {
      return listFavorites(request, env);
    }

    if (url.pathname === "/api/favorites" && request.method === "POST") {
      return saveFavorite(request, env);
    }

    if (url.pathname.startsWith("/api/favorites/") && request.method === "DELETE") {
      return deleteFavorite(request, env, decodeURIComponent(url.pathname.slice("/api/favorites/".length)));
    }

    if (url.pathname === "/api/generate" && request.method === "POST") {
      return generateRecipes(request, env);
    }

    if (url.pathname === "/api/catalog" && request.method === "GET") {
      return listRecipeCatalog(request, env);
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "kutno" });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Маршрут не найден" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
