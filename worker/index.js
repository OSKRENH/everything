import { createRemoteJWKSet, jwtVerify } from "jose";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
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
  const value = result?.response ?? result;
  if (typeof value === "object" && value?.recipes) return value;
  if (typeof value !== "string") throw new Error("Unexpected AI response");
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

const pantryBasics = ["соль", "вод", "масло"];

function isPantryBasic(value = "") {
  const normalized = value.toLowerCase().replace(/ё/g, "е");
  return pantryBasics.some((item) => normalized.includes(item));
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
  if (value.includes("яйц")) return `${Math.max(2, portions)} шт.`;
  if (value.includes("лук") || value.includes("помидор") || value.includes("картоф")) return `${Math.max(1, Math.ceil(portions / 2))} шт.`;
  if (value.includes("рис") || value.includes("греч") || value.includes("макарон") || value.includes("паст")) return `${portions * 90} г`;
  if (value.includes("куриц") || value.includes("мяс") || value.includes("рыб")) return `${portions * 160} г`;
  if (isPantryBasic(value) || value.includes("специ")) return "по вкусу";
  return `${portions * 100} г`;
}

function safeNutrition(value) {
  const number = (input, max) => Math.min(max, Math.max(0, Number(input) || 0));
  const nutrition = {
    calories: Math.round(number(value?.calories, 3000)),
    protein: Math.round(number(value?.protein, 300) * 10) / 10,
    fat: Math.round(number(value?.fat, 300) * 10) / 10,
    carbs: Math.round(number(value?.carbs, 600) * 10) / 10,
    estimated: true,
  };
  return nutrition.calories > 0 ? nutrition : null;
}

function cleanRecipeSteps(value) {
  const placeholders = /^(?:(?:sub)?title|description|step\s*\d*|шаг\s*\d*|null|undefined)$/i;
  return sanitizeList(value, 12, 400)
    .filter((step) => !placeholders.test(step.trim()))
    .filter((step) => step.length >= 12);
}

function normalizeRecipes(recipes, portions, ownedIngredients) {
  return recipes
    .map((recipe) => {
      const ingredients = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((item) => ({
            name: String(item?.name || "").trim(),
            amount: !item?.amount || /^(unit|units|штука)$/i.test(String(item.amount).trim())
              ? fallbackAmount(item?.name, portions)
              : String(item.amount).trim(),
          }))
        : [];
      const hasUnknownIngredient = !ingredients.length || ingredients.some((item) => !ingredientIsOwned(item.name, ownedIngredients));
      const hasMissing = sanitizeList(recipe.missing).some((item) => !isPantryBasic(item));
      const steps = cleanRecipeSteps(recipe.steps);
      const nutrition = safeNutrition(recipe.nutrition);
      const title = String(recipe.title || "").trim();
      const looksGeneric = /^(?:жареные|тушеные|вареные) (?:продукты|ингредиенты|овощи)$/i.test(title);
      if (hasUnknownIngredient || hasMissing || steps.length < 3 || !nutrition || title.length < 4 || looksGeneric) return null;
      const uses = ownedIngredients.filter((owned) =>
        ingredients.some((item) => ingredientIsOwned(item.name, [owned])),
      );
      return {
        ...recipe,
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
    minutes: String([15, 30, 60].includes(Number(value?.minutes)) ? Number(value.minutes) : 30),
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
      })).filter((item) => item.name && item.amount)
    : [];
  const steps = cleanRecipeSteps(value?.steps);
  const nutrition = safeNutrition(value?.nutrition);
  const title = String(value?.title || "").trim().slice(0, 120);
  if (!title || !ingredients.length || steps.length < 2 || !nutrition) return null;
  const recipe = {
    title,
    subtitle: String(value?.subtitle || "").trim().slice(0, 180),
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

async function generateRecipes(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Некорректный запрос" }, 400);
  }

  const ingredients = sanitizeList(body.ingredients);
  const equipment = sanitizeList(body.equipment, 12);
  const minutes = Math.min(120, Math.max(10, Number(body.minutes) || 30));
  const portions = Math.min(8, Math.max(1, Number(body.portions) || 2));
  if (!ingredients.length) return json({ error: "Добавьте хотя бы один продукт" }, 400);

  const system = `Ты — строгий редактор современной русской кулинарной книги. Предложи от 1 до 3 действительно существующих и кулинарно осмысленных домашних блюд. Качество важнее количества: если хороших вариантов меньше трёх, верни меньше. Не придумывай блюдо только ради заполнения списка. Пиши только по-русски, без англицизмов, заглушек, служебных слов и выдуманных техник.
ЖЁСТКОЕ ПРАВИЛО: используй только продукты из списка пользователя, а также соль, воду и растительное масло. Нельзя добавлять перец, чеснок, специи, соусы, сахар, муку, молоко, зелень или любой другой продукт, если его нет в списке. Поле missing всегда должно быть пустым массивом. В ingredients перечисли абсолютно всё, что используется в шагах; названия пользовательских продуктов сохраняй максимально близко к исходному списку. Не называй блюдо общими словами вроде «жареные продукты» или «смесь ингредиентов». В amount всегда указывай понятное русское количество: г, мл, ст. л., ч. л. или шт.; слово unit запрещено. Каждый рецепт должен содержать минимум три законченных конкретных шага с температурой или понятным уровнем огня и временем там, где это важно. Не выводи слова subtitle, title, description или step как содержимое полей. Не предлагай опасные способы приготовления.
Для каждого рецепта оцени КБЖУ НА ОДНУ ПОРЦИЮ по указанным количествам: calories — ккал, protein/fat/carbs — граммы. Значения должны быть реалистичными и согласованными с ингредиентами; это ориентировочная оценка.`;
  const user = `Продукты дома: ${ingredients.join(", ")}.
Инвентарь: ${equipment.length ? equipment.join(", ") : "обычная базовая кухня"}.
Время: до ${minutes} минут. Порций: ${portions}.
Никаких покупок и замен: каждый небазовый ингредиент обязан дословно соответствовать продукту из списка. Расположи блюда от самого подходящего. Количество ингредиентов укажи на ${portions} порции. match для каждого блюда — 100. В uses перечисли использованные продукты пользователя, missing — пустой массив. Лучше вернуть один хороший узнаваемый рецепт, чем три нелепых.`;

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      guided_json: recipeSchemaFor(ingredients),
      max_tokens: 2800,
      temperature: 0.15,
    });
    const data = parseAiResult(result);
    if (!Array.isArray(data.recipes) || !data.recipes.length) throw new Error("Incomplete recipes");
    const recipes = normalizeRecipes(data.recipes, portions, ingredients);
    if (!recipes.length) throw new Error("Recipes failed quality checks");
    return json({ recipes });
  } catch (error) {
    console.error("recipe_generation_failed", error instanceof Error ? error.message : String(error));
    return json({ error: "Не удалось составить меню" }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/config" && request.method === "GET") {
      return json({ googleClientId: env.GOOGLE_CLIENT_ID });
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

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "kutno" });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Маршрут не найден" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
