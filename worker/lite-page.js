import { loadRecipeBody } from "./catalog-page.js";
import { RUNTIME_RECIPES } from "./generated/catalog-runtime.js";

const PAGE_SIZE = 8;

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function normalize(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

function responseHtml(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    },
  });
}

function liteCss() {
  return `:root{color-scheme:light;--b:#fafaf7;--i:#11110f;--m:#74746e;--l:#d4d2ca}*{box-sizing:border-box}html,body{margin:0;background:var(--b);color:var(--i);font-family:Arial,sans-serif}body{padding:20px}.p{width:min(760px,100%);margin:auto}.h{display:flex;align-items:center;justify-content:space-between;padding:12px 0 20px;border-bottom:1px solid var(--i)}.logo{font:36px/1 Georgia,serif;text-decoration:none;color:var(--i)}.full{color:var(--i);font-size:13px}.hero{padding:46px 0 30px}.k{font-size:12px;letter-spacing:.16em;text-transform:uppercase}.hero h1{max-width:650px;margin:18px 0 14px;font:clamp(46px,11vw,82px)/.92 Georgia,serif;letter-spacing:-.055em}.hero p{max-width:570px;color:var(--m);line-height:1.5}.form{display:grid;gap:10px;padding:20px 0 28px;border-bottom:1px solid var(--i)}label{font-size:12px;letter-spacing:.12em;text-transform:uppercase}input{width:100%;border:0;border-bottom:1px solid var(--l);background:transparent;padding:13px 0;font:20px Georgia,serif;color:var(--i);outline:0}button,.btn{display:inline-block;width:max-content;border:1px solid var(--i);border-radius:999px;background:var(--i);color:var(--b);padding:11px 17px;text-decoration:none;font:14px Arial,sans-serif;cursor:pointer}.meta{padding:24px 0 10px;color:var(--m);font-size:12px;letter-spacing:.12em;text-transform:uppercase}.card{padding:24px 0;border-top:1px solid var(--l)}.card h2{margin:8px 0 8px;font:38px/1 Georgia,serif;letter-spacing:-.035em}.card p{margin:8px 0;color:var(--m);line-height:1.45}.tag{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--m)}.card a{color:var(--i)}.pager{display:flex;gap:10px;padding:28px 0;border-top:1px solid var(--i)}.recipe h1{margin:24px 0 12px;font:clamp(48px,12vw,86px)/.9 Georgia,serif;letter-spacing:-.055em}.recipe h2{margin-top:34px;font:26px Georgia,serif}.recipe li{margin:10px 0;line-height:1.5}.back{display:inline-block;margin-top:28px;color:var(--i)}.note{padding:14px;border:1px solid var(--l);color:var(--m);line-height:1.45}@media(max-width:520px){body{padding:16px}.hero{padding-top:34px}.card h2{font-size:34px}}`;
}

function layout(title, content) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fafaf7"><title>${escapeHtml(title)} · Кутно</title><style>${liteCss()}</style></head><body><main class="p"><header class="h"><a class="logo" href="/lite">Кутно</a><a class="full" href="/">Полная версия</a></header>${content}</main></body></html>`;
}

function liteRecipes() {
  return RUNTIME_RECIPES.map((recipe) => ({
    id: String(recipe.id),
    title: recipe.title,
    subtitle: recipe.subtitle,
    cuisine: recipe.cuisine || "Домашняя кухня",
    flag: recipe.flag || "🌍",
    course: recipe.course || "основное",
    minutes: Number(recipe.minutes) || 30,
    difficulty: recipe.difficulty || "легко",
    ingredients: (recipe.ingredients || []).map((item) => ({ ...item, amountText: String(item.amount || "по вкусу") })),
  }));
}

function productTerms(value = "") {
  return String(value).split(/[,;\n]+/).map(normalize).filter(Boolean);
}

function recipeScore(recipe, query, products) {
  const ingredientText = recipe.ingredients.map((item) => normalize(item.name)).join(" ");
  const haystack = normalize([recipe.title, recipe.subtitle, recipe.cuisine, ingredientText].join(" "));
  if (query && !haystack.includes(query)) return null;
  const matched = products.filter((product) => ingredientText.includes(product)).length;
  return { matched, missing: Math.max(0, products.length - matched) };
}

function listPage(request) {
  const url = new URL(request.url);
  const qRaw = url.searchParams.get("q") || "";
  const productsRaw = url.searchParams.get("products") || "";
  const query = normalize(qRaw);
  const products = productTerms(productsRaw);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const scored = liteRecipes().map((recipe, index) => {
    const score = recipeScore(recipe, query, products);
    return score ? { recipe, index, ...score } : null;
  }).filter(Boolean).sort((a, b) => b.matched - a.matched || a.missing - b.missing || a.index - b.index);
  const offset = (page - 1) * PAGE_SIZE;
  const shown = scored.slice(offset, offset + PAGE_SIZE);
  const params = new URLSearchParams();
  if (qRaw) params.set("q", qRaw);
  if (productsRaw) params.set("products", productsRaw);
  const cards = shown.length ? shown.map(({ recipe, matched, missing }) => {
    const recipeParams = new URLSearchParams({ id: recipe.id });
    return `<article class="card"><div class="tag">${escapeHtml(recipe.flag)} ${escapeHtml(recipe.cuisine)} · ${escapeHtml(recipe.course)} · ${recipe.minutes} мин</div><h2><a href="/lite/recipe?${recipeParams}">${escapeHtml(recipe.title)}</a></h2><p>${escapeHtml(recipe.subtitle || "")}</p>${products.length ? `<p>Совпало продуктов: ${matched}${missing ? ` · не указано: ${missing}` : " · всё указано"}</p>` : ""}</article>`;
  }).join("") : `<p class="note">Ничего не нашлось. Уберите часть запроса или укажите продукты проще.</p>`;
  const pager = `<nav class="pager">${page > 1 ? `<a class="btn" href="/lite?${new URLSearchParams([...params, ["page", String(page - 1)]])}">Назад</a>` : ""}${offset + PAGE_SIZE < scored.length ? `<a class="btn" href="/lite?${new URLSearchParams([...params, ["page", String(page + 1)]])}">Ещё рецепты</a>` : ""}</nav>`;
  return responseHtml(layout("Лёгкая версия", `<section class="hero"><div class="k">Лёгкая версия</div><h1>Рецепты без тяжёлой загрузки</h1><p>Работает без изображений, авторизации и клиентского приложения. Введите блюдо, страну или продукты через запятую.</p></section><form class="form" action="/lite" method="get"><label for="q">Поиск</label><input id="q" name="q" value="${escapeHtml(qRaw)}" placeholder="Блюдо или страна"><label for="products">Продукты</label><input id="products" name="products" value="${escapeHtml(productsRaw)}" placeholder="яйца, рис, помидоры"><button type="submit">Найти рецепты</button></form><div class="meta">Найдено — ${scored.length}</div>${cards}${pager}`));
}

async function recipePage(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const recipe = await loadRecipeBody(request, env, id, 2);
  if (!recipe) return responseHtml(layout("Рецепт не найден", `<section class="hero"><h1>Рецепт не найден</h1><a class="back" href="/lite">Вернуться к поиску</a></section>`), 404);
  const ingredients = (recipe.ingredients || []).map((item) => `<li><strong>${escapeHtml(item.name)}</strong>${item.amount ? ` — ${escapeHtml(item.amount)}` : ""}</li>`).join("");
  const steps = (recipe.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return responseHtml(layout(recipe.title, `<article class="recipe"><a class="back" href="/lite">← Все рецепты</a><div class="tag">${escapeHtml(recipe.flag || "🌍")} ${escapeHtml(recipe.cuisine || "")} · ${escapeHtml(recipe.course || "")} · ${Number(recipe.minutes) || 30} мин</div><h1>${escapeHtml(recipe.title)}</h1><p>${escapeHtml(recipe.subtitle || "")}</p><h2>Ингредиенты</h2><ul>${ingredients}</ul><h2>Как готовить</h2><ol>${steps}</ol>${recipe.tip ? `<p class="note"><strong>Совет:</strong> ${escapeHtml(recipe.tip)}</p>` : ""}</article>`));
}

export async function serveLitePage(request, env) {
  const pathname = new URL(request.url).pathname;
  return pathname === "/lite/recipe" ? recipePage(request, env) : listPage(request);
}
