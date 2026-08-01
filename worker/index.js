const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const recipeSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      minItems: 3,
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
          tip: { type: "string" },
        },
        required: ["title", "subtitle", "minutes", "difficulty", "match", "missing", "uses", "equipment", "why", "ingredients", "steps", "tip"],
      },
    },
  },
  required: ["recipes"],
};

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

function sanitizeList(value, max = 40) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 80))
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

const pantryBasics = ["соль", "вод", "масло", "перец"];

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
      if (hasUnknownIngredient || hasMissing) return null;
      return {
        ...recipe,
        match: 100,
        missing: [],
        uses: sanitizeList(recipe.uses).filter((item) => ingredientIsOwned(item, ownedIngredients)),
        equipment: sanitizeList(recipe.equipment, 12),
        ingredients,
        steps: sanitizeList(recipe.steps, 12),
        why: String(recipe.why || "Все продукты для этого блюда уже есть дома"),
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

const SESSION_COOKIE = "kutno_session";
const SESSION_TTL = 60 * 60 * 24 * 30;
let schemaPromise;

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
  if (!schemaPromise) {
    schemaPromise = env.DB.batch([
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
      env.DB.prepare("CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)"),
    ]).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
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

  const system = `Ты — внимательный редактор современной русской кулинарной книги. Составь ровно 3 реалистичных домашних рецепта. Пиши только по-русски, без англицизмов и выдуманных техник.
ЖЁСТКОЕ ПРАВИЛО: используй только продукты из списка пользователя, а также соль, воду, растительное масло и чёрный перец. Нельзя добавлять чеснок, специи, соусы, сахар, муку, молоко, зелень или любой другой продукт, если его нет в списке. Поле missing всегда должно быть пустым массивом. В ingredients перечисли абсолютно всё, что используется в шагах; названия пользовательских продуктов сохраняй максимально близко к исходному списку. Если продуктов мало, сделай три разные техники или варианта из них, но ничего не выдумывай. В amount всегда указывай понятное русское количество: г, мл, ст. л., ч. л. или шт.; слово unit запрещено. Не предлагай опасные способы приготовления. Каждый шаг должен быть коротким, конкретным и выполнимым.`;
  const user = `Продукты дома: ${ingredients.join(", ")}.
Инвентарь: ${equipment.length ? equipment.join(", ") : "обычная базовая кухня"}.
Время: до ${minutes} минут. Порций: ${portions}.
Никаких покупок и замен: каждый небазовый ингредиент обязан дословно соответствовать продукту из списка. Расположи блюда от самого подходящего. Количество ингредиентов укажи на ${portions} порции. match для каждого блюда — 100. В uses перечисли использованные продукты пользователя, missing — пустой массив.`;

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      guided_json: recipeSchema,
      max_tokens: 2200,
      temperature: 0.25,
    });
    const data = parseAiResult(result);
    if (!Array.isArray(data.recipes) || data.recipes.length < 3) throw new Error("Incomplete recipes");
    const recipes = normalizeRecipes(data.recipes, portions, ingredients);
    if (recipes.length < 3) throw new Error("Recipes contained unavailable ingredients");
    return json({ recipes });
  } catch (error) {
    console.error("recipe_generation_failed", error instanceof Error ? error.message : String(error));
    return json({ error: "Не удалось составить меню" }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
