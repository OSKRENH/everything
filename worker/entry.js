import baseWorker from "./index.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function cleanString(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function sanitizeRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return null;
  const title = cleanString(recipe.title, 180);
  if (!title) return null;
  const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).slice(0, 50).flatMap((item) => {
    const name = cleanString(item?.name, 120);
    if (!name) return [];
    const info = item?.info && typeof item.info === "object" ? {
      description: cleanString(item.info.description, 500),
      substitutes: cleanString(item.info.substitutes, 500),
    } : undefined;
    return [{
      name,
      amount: cleanString(item?.amount, 100),
      note: cleanString(item?.note, 220),
      pantry: Boolean(item?.pantry),
      aliases: (Array.isArray(item?.aliases) ? item.aliases : []).map((value) => cleanString(value, 80)).filter(Boolean).slice(0, 12),
      ...(info ? { info } : {}),
    }];
  });
  const steps = (Array.isArray(recipe.steps) ? recipe.steps : []).map((step) => cleanString(step, 800)).filter(Boolean).slice(0, 40);
  return {
    title,
    subtitle: cleanString(recipe.subtitle, 300),
    course: cleanString(recipe.course, 80),
    cuisine: cleanString(recipe.cuisine, 80),
    flag: cleanString(recipe.flag, 12),
    protein: cleanString(recipe.protein, 80),
    minutes: Math.round(cleanNumber(recipe.minutes, 1, 1440)),
    difficulty: cleanString(recipe.difficulty, 80),
    portions: Math.round(cleanNumber(recipe.portions, 1, 24)),
    ingredients,
    steps,
    equipment: (Array.isArray(recipe.equipment) ? recipe.equipment : []).map((value) => cleanString(value, 100)).filter(Boolean).slice(0, 20),
    tip: cleanString(recipe.tip, 800),
    why: cleanString(recipe.why, 800),
    uses: (Array.isArray(recipe.uses) ? recipe.uses : []).map((value) => cleanString(value, 100)).filter(Boolean).slice(0, 30),
    missing: (Array.isArray(recipe.missing) ? recipe.missing : []).map((value) => cleanString(value, 100)).filter(Boolean).slice(0, 20),
    nutrition: {
      calories: cleanNumber(recipe.nutrition?.calories, 0, 5000),
      protein: cleanNumber(recipe.nutrition?.protein, 0, 500),
      fat: cleanNumber(recipe.nutrition?.fat, 0, 500),
      carbs: cleanNumber(recipe.nutrition?.carbs, 0, 1000),
      checked: Boolean(recipe.nutrition?.checked),
    },
    source: recipe.source && typeof recipe.source === "object" ? {
      type: cleanString(recipe.source.type, 40),
      name: cleanString(recipe.source.name, 120),
      url: cleanString(recipe.source.url, 500),
      note: cleanString(recipe.source.note, 500),
      id: cleanNumber(recipe.source.id, 0, Number.MAX_SAFE_INTEGER),
    } : undefined,
  };
}

function stableRecipeId(recipe) {
  const signature = [
    recipe.title.toLowerCase().replace(/ё/g, "е").trim(),
    ...recipe.ingredients.map((item) => item.name.toLowerCase().replace(/ё/g, "е").trim()).sort(),
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `r-${(hash >>> 0).toString(36)}`;
}

function sanitizeShopping(value) {
  return (Array.isArray(value) ? value : []).slice(0, 200).flatMap((item) => {
    const name = cleanString(item?.name, 120);
    if (!name) return [];
    return [{
      id: cleanString(item?.id, 160) || name.toLowerCase(),
      name,
      amount: cleanString(item?.amount, 120),
      checked: Boolean(item?.checked),
      recipeTitles: (Array.isArray(item?.recipeTitles) ? item.recipeTitles : [item?.recipeTitle]).map((title) => cleanString(title, 180)).filter(Boolean).slice(0, 12),
      addedAt: Math.round(cleanNumber(item?.addedAt, 0)),
      updatedAt: Math.round(cleanNumber(item?.updatedAt, 0)),
    }];
  });
}

function sanitizePortions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 300).flatMap(([key, entry]) => {
    const id = cleanString(key, 180);
    const amount = typeof entry === "object" ? entry?.value : entry;
    const portions = Math.round(cleanNumber(amount, 1, 24));
    if (!id || !portions) return [];
    return [[id, {
      value: portions,
      updatedAt: Math.round(cleanNumber(typeof entry === "object" ? entry?.updatedAt : 0, 0)),
    }]];
  }));
}

function sanitizeCooking(value) {
  if (!value || typeof value !== "object") return null;
  const recipe = sanitizeRecipe(value.recipe);
  const recipeId = cleanString(value.recipeId, 100) || (recipe ? stableRecipeId(recipe) : "");
  if (!recipeId && !cleanString(value.title, 180)) return null;
  return {
    recipeId,
    title: cleanString(value.title || recipe?.title, 180),
    recipe,
    step: Math.round(cleanNumber(value.step, 0, 200)),
    timerEndsAt: Math.round(cleanNumber(value.timerEndsAt, 0)),
    updatedAt: Math.round(cleanNumber(value.updatedAt, 0)),
  };
}

function sanitizeFeatureState(value) {
  return {
    shopping: sanitizeShopping(value?.shopping),
    portions: sanitizePortions(value?.portions),
    cooking: sanitizeCooking(value?.cooking),
    updatedAt: Math.round(cleanNumber(value?.updatedAt, 0)),
  };
}

async function ensureTables(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_feature_state (
      user_id INTEGER PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS shared_recipes (
      id TEXT PRIMARY KEY,
      recipe_json TEXT NOT NULL,
      created_by INTEGER,
      created_at INTEGER NOT NULL
    )`),
  ]);
}

async function authenticatedUser(request, env, ctx) {
  const url = new URL(request.url);
  url.pathname = "/api/auth/me";
  url.search = "";
  const authRequest = new Request(url, {
    method: "GET",
    headers: request.headers,
  });
  const response = await baseWorker.fetch(authRequest, env, ctx);
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.user || null;
}

async function featureState(request, env, ctx) {
  const user = await authenticatedUser(request, env, ctx);
  if (!user) return json({ error: "Войдите в аккаунт" }, 401);
  await ensureTables(env);
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT state_json FROM user_feature_state WHERE user_id = ?").bind(user.id).first();
    if (!row?.state_json) return json({ state: sanitizeFeatureState({}) });
    try {
      return json({ state: sanitizeFeatureState(JSON.parse(row.state_json)) });
    } catch {
      return json({ state: sanitizeFeatureState({}) });
    }
  }
  const body = await request.json().catch(() => ({}));
  const state = sanitizeFeatureState(body);
  state.updatedAt = Date.now();
  await env.DB.prepare(`INSERT INTO user_feature_state (user_id, state_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`)
    .bind(user.id, JSON.stringify(state), state.updatedAt)
    .run();
  return json({ ok: true, state });
}

async function createSharedRecipe(request, env, ctx) {
  const user = await authenticatedUser(request, env, ctx);
  if (!user) return json({ error: "Войдите в аккаунт, чтобы создать общую ссылку" }, 401);
  const body = await request.json().catch(() => ({}));
  const recipe = sanitizeRecipe(body.recipe);
  if (!recipe) return json({ error: "Рецепт не найден" }, 400);
  const id = stableRecipeId(recipe);
  await ensureTables(env);
  await env.DB.prepare(`INSERT INTO shared_recipes (id, recipe_json, created_by, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET recipe_json = excluded.recipe_json, created_by = excluded.created_by, created_at = excluded.created_at`)
    .bind(id, JSON.stringify(recipe), user.id, Date.now())
    .run();
  return json({ id, recipe });
}

async function getSharedRecipe(id, env) {
  await ensureTables(env);
  const row = await env.DB.prepare("SELECT recipe_json FROM shared_recipes WHERE id = ?").bind(id).first();
  if (!row?.recipe_json) return json({ error: "Рецепт не найден" }, 404);
  try {
    const recipe = sanitizeRecipe(JSON.parse(row.recipe_json));
    return recipe ? json({ id, recipe }) : json({ error: "Рецепт повреждён" }, 410);
  } catch {
    return json({ error: "Рецепт повреждён" }, 410);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/feature-state" && ["GET", "PUT"].includes(request.method)) {
      return featureState(request, env, ctx);
    }
    if (url.pathname === "/api/shared-recipes" && request.method === "POST") {
      return createSharedRecipe(request, env, ctx);
    }
    const sharedMatch = url.pathname.match(/^\/api\/shared-recipes\/(r-[a-z0-9]+)$/i);
    if (sharedMatch && request.method === "GET") {
      return getSharedRecipe(sharedMatch[1], env);
    }
    return baseWorker.fetch(request, env, ctx);
  },
};
