import { catalogSources, fullRecipeForSource, sourceIdentity } from "./catalog-page.js";

const SITE_ORIGIN = "https://kutno.ru";
const HTML_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=600";
const TEXT_CACHE = "public, max-age=900, s-maxage=3600, stale-while-revalidate=600";

const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value = "") {
  return escapeHtml(value);
}

function jsonScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function cleanText(value = "", maxLength = 220) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function absoluteUrl(pathname = "/") {
  return new URL(pathname, SITE_ORIGIN).toString();
}

export function seoSlug(value = "") {
  return String(value)
    .toLocaleLowerCase("ru-RU")
    .split("")
    .map((character) => CYRILLIC[character] ?? character)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "recipe";
}

function uniqueRecipeEntries(portions = 2) {
  const usedSlugs = new Map();
  return catalogSources(portions).map((source) => {
    const recipe = fullRecipeForSource(source, portions);
    const baseSlug = seoSlug(recipe?.title || sourceIdentity(source.kind, source.recipe));
    const seen = usedSlugs.get(baseSlug) || 0;
    usedSlugs.set(baseSlug, seen + 1);
    const slug = seen ? `${baseSlug}-${seen + 1}` : baseSlug;
    return {
      source,
      recipe,
      id: sourceIdentity(source.kind, source.recipe),
      slug,
      pathname: `/recipe/${slug}`,
    };
  }).filter((entry) => entry.recipe?.title);
}

export function seoRecipeEntries(portions = 2) {
  return uniqueRecipeEntries(portions);
}

function recipeDescription(recipe) {
  const subtitle = cleanText(recipe?.subtitle, 140);
  const fallback = `Пошаговый рецепт «${cleanText(recipe?.title, 90)}» с ингредиентами, временем приготовления и КБЖУ.`;
  return cleanText(subtitle ? `${recipe.title} — ${subtitle}` : fallback, 170);
}

function imageUrls(recipe) {
  const candidates = [
    ...(Array.isArray(recipe?.images) ? recipe.images : []),
    ...(Array.isArray(recipe?.image) ? recipe.image : recipe?.image ? [recipe.image] : []),
  ];
  return [...new Set(candidates.map((value) => String(value || "").trim()).filter((value) => /^https:\/\//i.test(value)))];
}

function ingredientLine(item) {
  const name = cleanText(item?.name, 140);
  const amount = cleanText(item?.amount, 90);
  return amount ? `${amount} ${name}`.trim() : name;
}

function recipeSchema(entry) {
  const { recipe, pathname } = entry;
  const canonical = absoluteUrl(pathname);
  const images = imageUrls(recipe);
  const nutrition = recipe?.nutrition || {};
  const portions = Math.max(1, Number(recipe?.portions) || 2);
  const schema = {
    "@type": "Recipe",
    "@id": `${canonical}#recipe`,
    name: cleanText(recipe.title, 180),
    description: recipeDescription(recipe),
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: "Кутно", url: SITE_ORIGIN },
    totalTime: `PT${Math.max(1, Math.round(Number(recipe.minutes) || 30))}M`,
    recipeYield: String(portions),
    recipeCuisine: cleanText(recipe.cuisine, 100),
    recipeCategory: cleanText(recipe.course, 100),
    recipeIngredient: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(ingredientLine).filter(Boolean),
    recipeInstructions: (Array.isArray(recipe.steps) ? recipe.steps : []).map((step, index) => ({
      "@type": "HowToStep",
      text: cleanText(step, 900),
      url: `${canonical}#step-${index + 1}`,
    })).filter((step) => step.text),
  };

  if (images.length) schema.image = images;
  if (Number(nutrition.calories) > 0) {
    schema.nutrition = {
      "@type": "NutritionInformation",
      calories: `${Math.round(Number(nutrition.calories))} kcal`,
      ...(Number(nutrition.protein) > 0 ? { proteinContent: `${Number(nutrition.protein)} g` } : {}),
      ...(Number(nutrition.fat) > 0 ? { fatContent: `${Number(nutrition.fat)} g` } : {}),
      ...(Number(nutrition.carbs) > 0 ? { carbohydrateContent: `${Number(nutrition.carbs)} g` } : {}),
    };
  }
  if (/^https:\/\//i.test(recipe?.source?.url || "")) schema.isBasedOn = recipe.source.url;
  return schema;
}

function breadcrumbSchema(entry) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Кутно", item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Рецепты", item: `${SITE_ORIGIN}/recipes` },
      { "@type": "ListItem", position: 3, name: cleanText(entry.recipe.title, 180), item: absoluteUrl(entry.pathname) },
    ],
  };
}

function pageCss() {
  return `:root{color-scheme:light;--bg:#fafaf7;--ink:#11110f;--muted:#74746e;--line:#d4d2ca;--soft:#efeee9}*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif}body{padding:22px}.page{width:min(920px,100%);margin:auto}.head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 0 22px;border-bottom:1px solid var(--ink)}.logo{color:var(--ink);text-decoration:none;font:40px/1 Georgia,serif;letter-spacing:-.05em}.nav{display:flex;gap:14px;flex-wrap:wrap}.nav a,.back{color:var(--ink);font-size:13px}.hero{padding:52px 0 34px}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}h1{max-width:820px;margin:16px 0 18px;font:clamp(50px,9vw,96px)/.9 Georgia,serif;letter-spacing:-.06em;font-weight:400}.lead{max-width:680px;margin:0;color:var(--muted);font-size:18px;line-height:1.55}.count{padding:18px 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);font-size:12px;letter-spacing:.14em;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}.card{padding:26px 0;border-bottom:1px solid var(--line)}.card h2{margin:9px 0 9px;font:34px/1 Georgia,serif;letter-spacing:-.035em}.card h2 a{color:var(--ink);text-decoration:none}.card p{margin:0;color:var(--muted);line-height:1.45}.meta{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.recipe{padding:36px 0 70px}.recipe h1{margin-top:20px}.recipe-summary{max-width:680px;color:var(--muted);font-size:18px;line-height:1.55}.facts{display:flex;gap:10px;flex-wrap:wrap;margin:26px 0 34px}.fact{padding:9px 12px;border:1px solid var(--line);border-radius:999px;font-size:12px}.columns{display:grid;grid-template-columns:minmax(220px,.75fr) minmax(0,1.4fr);gap:56px;border-top:1px solid var(--ink);padding-top:34px}.section h2{margin:0 0 18px;font:30px Georgia,serif}.section ul,.section ol{margin:0;padding-left:21px}.section li{margin:0 0 13px;line-height:1.5}.steps{counter-reset:steps;list-style:none;padding:0!important}.steps li{counter-increment:steps;position:relative;padding:0 0 22px 48px;border-bottom:1px solid var(--line);margin:0 0 22px}.steps li:before{content:counter(steps);position:absolute;left:0;top:-4px;width:30px;height:30px;border:1px solid var(--ink);border-radius:50%;display:grid;place-items:center;font-size:12px}.nutrition{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:28px}.nutrition div{padding:14px;background:var(--soft)}.nutrition strong{display:block;font:22px Georgia,serif}.nutrition span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.note{margin-top:28px;padding:18px;border:1px solid var(--line);line-height:1.5}.source{margin-top:26px;color:var(--muted);font-size:12px;line-height:1.5}.source a{color:inherit}.empty{padding:54px 0}.empty h1{font-size:64px}.foot{padding:20px 0;border-top:1px solid var(--ink);font-size:12px;color:var(--muted)}@media(max-width:700px){body{padding:16px}.head{align-items:flex-start}.logo{font-size:34px}.grid{grid-template-columns:1fr}.columns{grid-template-columns:1fr;gap:38px}.nutrition{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{padding-top:38px}.recipe{padding-top:28px}}`;
}

function htmlLayout({ title, description, canonical, body, structuredData, robots = "index,follow,max-image-preview:large" }) {
  const scripts = (Array.isArray(structuredData) ? structuredData : structuredData ? [structuredData] : [])
    .map((data) => `<script type="application/ld+json">${jsonScript(data)}</script>`)
    .join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fafaf7"><meta name="robots" content="${escapeHtml(robots)}"><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="Кутно"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta name="twitter:card" content="summary"><title>${escapeHtml(title)}</title>${scripts}<style>${pageCss()}</style></head><body><main class="page"><header class="head"><a class="logo" href="/">Кутно</a><nav class="nav" aria-label="Основная навигация"><a href="/">Подбор по продуктам</a><a href="/recipes">Все рецепты</a></nav></header>${body}<footer class="foot">Кутно · рецепты из того, что уже есть дома</footer></main></body></html>`;
}

function responseHtml(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-language": "ru",
      "cache-control": status >= 400 ? "public, max-age=60" : HTML_CACHE,
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function responseText(body, contentType, cache = TEXT_CACHE) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": cache,
      "x-content-type-options": "nosniff",
    },
  });
}

function listPage() {
  const entries = seoRecipeEntries(2);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Рецепты Кутно",
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(entry.pathname),
    })),
  };
  const cards = entries.map(({ recipe, pathname }) => `<article class="card"><div class="meta">${escapeHtml(recipe.flag || "🍽️")} ${escapeHtml(recipe.cuisine || "Домашняя кухня")} · ${escapeHtml(recipe.course || "основное")} · ${Math.max(1, Number(recipe.minutes) || 30)} мин</div><h2><a href="${escapeHtml(pathname)}">${escapeHtml(recipe.title)}</a></h2><p>${escapeHtml(recipe.subtitle || "Пошаговый рецепт с понятными ингредиентами и приготовлением.")}</p></article>`).join("");
  const description = `Все рецепты Кутно: ${entries.length} проверенных вариантов с ингредиентами, шагами и временем приготовления.`;
  return responseHtml(htmlLayout({
    title: "Рецепты Кутно — блюда из того, что есть дома",
    description,
    canonical: `${SITE_ORIGIN}/recipes`,
    structuredData,
    body: `<section class="hero"><div class="eyebrow">База рецептов</div><h1>Рецепты Кутно</h1><p class="lead">Домашние блюда и мировая классика. Каждый рецепт открывается отдельной лёгкой страницей без авторизации и без обязательного JavaScript.</p></section><div class="count">В базе — ${entries.length}</div><section class="grid" aria-label="Все рецепты">${cards}</section>`,
  }));
}

function nutritionHtml(recipe) {
  const nutrition = recipe?.nutrition || {};
  const values = [
    [Math.round(Number(nutrition.calories) || 0), "ккал"],
    [Number(nutrition.protein) || 0, "белки"],
    [Number(nutrition.fat) || 0, "жиры"],
    [Number(nutrition.carbs) || 0, "углеводы"],
  ];
  if (!values.some(([value]) => value > 0)) return "";
  return `<div class="nutrition" aria-label="КБЖУ">${values.map(([value, label]) => `<div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("")}</div>`;
}

function recipePage(slug) {
  const entry = seoRecipeEntries(2).find((item) => item.slug === slug);
  if (!entry) return notFoundPage();
  const { recipe, pathname } = entry;
  const canonical = absoluteUrl(pathname);
  const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item) => `<li><strong>${escapeHtml(item.name)}</strong>${item.amount ? ` — ${escapeHtml(item.amount)}` : ""}</li>`).join("");
  const steps = (Array.isArray(recipe.steps) ? recipe.steps : []).map((step, index) => `<li id="step-${index + 1}">${escapeHtml(step)}</li>`).join("");
  const source = /^https:\/\//i.test(recipe?.source?.url || "")
    ? `<p class="source">Источник основы рецепта: <a href="${escapeHtml(recipe.source.url)}" rel="nofollow noopener">${escapeHtml(recipe.source.name || recipe.source.url)}</a>${recipe.source.license ? ` · ${escapeHtml(recipe.source.license)}` : ""}</p>`
    : recipe?.source?.name ? `<p class="source">Источник: ${escapeHtml(recipe.source.name)}</p>` : "";
  const schemaGraph = {
    "@context": "https://schema.org",
    "@graph": [recipeSchema(entry), breadcrumbSchema(entry)],
  };
  const description = recipeDescription(recipe);
  return responseHtml(htmlLayout({
    title: `${recipe.title} — рецепт | Кутно`,
    description,
    canonical,
    structuredData: schemaGraph,
    body: `<article class="recipe"><a class="back" href="/recipes">← Все рецепты</a><div class="meta" style="margin-top:28px">${escapeHtml(recipe.flag || "🍽️")} ${escapeHtml(recipe.cuisine || "Домашняя кухня")} · ${escapeHtml(recipe.course || "основное")}</div><h1>${escapeHtml(recipe.title)}</h1><p class="recipe-summary">${escapeHtml(recipe.subtitle || description)}</p><div class="facts"><span class="fact">${Math.max(1, Number(recipe.minutes) || 30)} мин</span><span class="fact">${escapeHtml(recipe.difficulty || "легко")}</span><span class="fact">${Math.max(1, Number(recipe.portions) || 2)} порции</span></div><div class="columns"><section class="section"><h2>Ингредиенты</h2><ul>${ingredients}</ul>${nutritionHtml(recipe)}${source}</section><section class="section"><h2>Как готовить</h2><ol class="steps">${steps}</ol>${recipe.tip ? `<p class="note"><strong>Совет:</strong> ${escapeHtml(recipe.tip)}</p>` : ""}</section></div></article>`,
  }));
}

function notFoundPage() {
  const description = "Такого рецепта в Кутно нет. Откройте полную базу рецептов и выберите другой вариант.";
  return responseHtml(htmlLayout({
    title: "Рецепт не найден | Кутно",
    description,
    canonical: `${SITE_ORIGIN}/recipes`,
    robots: "noindex,follow",
    body: `<section class="empty"><div class="eyebrow">404</div><h1>Рецепт не найден</h1><p class="lead">Возможно, ссылка устарела. В базе есть другие рецепты.</p><p><a class="back" href="/recipes">Открыть все рецепты</a></p></section>`,
  }), 404, { "x-robots-tag": "noindex, follow" });
}

function sitemap() {
  const entries = seoRecipeEntries(2);
  const urls = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/recipes`, ...entries.map((entry) => absoluteUrl(entry.pathname))];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return responseText(body, "application/xml; charset=utf-8");
}

function robots() {
  return responseText(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /lite\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, "text/plain; charset=utf-8");
}

function canonicalRedirect(pathname) {
  return Response.redirect(absoluteUrl(pathname), 301);
}

function headOnly(request, response) {
  if (request.method !== "HEAD") return response;
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function serveSeoRequest(request) {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  const url = new URL(request.url);
  let response = null;

  if (url.pathname === "/robots.txt") response = robots();
  else if (url.pathname === "/sitemap.xml") response = sitemap();
  else if (url.pathname === "/recipes/") response = canonicalRedirect("/recipes");
  else if (url.pathname === "/recipes") response = listPage();
  else if (url.pathname === "/recipe" || url.pathname === "/recipe/") response = canonicalRedirect("/recipes");
  else if (/^\/recipe\/[^/]+\/$/.test(url.pathname)) response = canonicalRedirect(url.pathname.slice(0, -1));
  else if (url.pathname.startsWith("/recipe/")) response = recipePage(url.pathname.slice("/recipe/".length));

  return response ? headOnly(request, response) : null;
}
