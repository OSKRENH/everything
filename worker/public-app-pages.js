import { loadRecipeBody } from "./catalog-page.js";
import { seoRecipeEntries } from "./seo-pages.js";
import { recipeImageSet, recipeImageUrls } from "./recipe-images.js";

const SITE_ORIGIN = "https://kutno.ru";
const HTML_CACHE = "public, max-age=300, s-maxage=1800, stale-while-revalidate=600";
const CONTENT_PUBLISHED = "2026-08-10";
const CONTENT_MODIFIED = "2026-08-10";

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function jsonScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function cleanText(value = "", maxLength = 220) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function canonical(pathname) {
  return new URL(pathname, SITE_ORIGIN).toString();
}

function recipeDescription(recipe) {
  const subtitle = cleanText(recipe?.subtitle, 140);
  if (subtitle) return cleanText(`${recipe.title} — ${subtitle}`, 170);
  return cleanText(`Пошаговый рецепт «${recipe?.title || ""}» с ингредиентами, временем приготовления и КБЖУ.`, 170);
}

function ingredientLine(item) {
  const name = cleanText(item?.name, 140);
  const amount = cleanText(item?.amount, 90);
  return amount ? `${amount} ${name}`.trim() : name;
}

function recipeStructuredData(entry) {
  const { recipe, pathname } = entry;
  const url = canonical(pathname);
  const images = recipeImageUrls(entry.recipe, entry.slug);
  const nutrition = recipe?.nutrition || {};
  const portions = Math.max(1, Number(recipe?.portions) || 2);
  const recipeData = {
    "@type": "Recipe",
    "@id": `${url}#recipe`,
    name: cleanText(recipe.title, 180),
    description: recipeDescription(recipe),
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: "Кутно", url: SITE_ORIGIN },
    datePublished: CONTENT_PUBLISHED,
    dateModified: CONTENT_MODIFIED,
    totalTime: `PT${Math.max(1, Math.round(Number(recipe.minutes) || 30))}M`,
    recipeYield: String(portions),
    recipeCuisine: cleanText(recipe.cuisine, 100),
    recipeCategory: cleanText(recipe.course, 100),
    recipeIngredient: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(ingredientLine).filter(Boolean),
    recipeInstructions: (Array.isArray(recipe.steps) ? recipe.steps : []).map((step, index) => ({
      "@type": "HowToStep",
      text: cleanText(step, 900),
      url: `${url}#step-${index + 1}`,
    })).filter((step) => step.text),
  };
  if (images.length) recipeData.image = images;
  if (Number(nutrition.calories) > 0) {
    recipeData.nutrition = {
      "@type": "NutritionInformation",
      calories: `${Math.round(Number(nutrition.calories))} kcal`,
      ...(Number(nutrition.protein) > 0 ? { proteinContent: `${Number(nutrition.protein)} g` } : {}),
      ...(Number(nutrition.fat) > 0 ? { fatContent: `${Number(nutrition.fat)} g` } : {}),
      ...(Number(nutrition.carbs) > 0 ? { carbohydrateContent: `${Number(nutrition.carbs)} g` } : {}),
    };
  }
  if (/^https:\/\//i.test(recipe?.source?.url || "")) recipeData.isBasedOn = recipe.source.url;
  return {
    "@context": "https://schema.org",
    "@graph": [
      recipeData,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Кутно", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "База рецептов", item: `${SITE_ORIGIN}/recipes` },
          { "@type": "ListItem", position: 3, name: cleanText(recipe.title, 180), item: url },
        ],
      },
    ],
  };
}

function catalogStructuredData(entries) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "База рецептов Кутно",
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: cleanText(entry.recipe.title, 180),
      url: canonical(entry.pathname),
    })),
  };
}

function replaceHeadValue(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `${replacement}\n</head>`);
}

function stripHeadMeta(html, pattern) {
  return html.replace(pattern, "");
}

function routeContent(route, entries) {
  if (route.type === "catalog") {
    const links = entries.map((entry) => {
      const photo = recipeImageSet(entry.recipe, entry.slug);
      const preview = photo
        ? `<img class="seo-recipe-preview" src="${escapeHtml(photo.square)}" alt="${escapeHtml(entry.recipe.title)}" width="1200" height="1200" loading="lazy" decoding="async">`
        : "";
      return `<li>${preview}<a href="${escapeHtml(entry.pathname)}">${escapeHtml(entry.recipe.title)}</a></li>`;
    }).join("");
    return `<section aria-label="Список рецептов"><h2>Все рецепты</h2><p>Полная база Кутно доступна без авторизации.</p><ul class="seo-recipe-list">${links}</ul></section>`;
  }
  const recipe = route.recipe;
  const photo = recipeImageSet(recipe, route.slug);
  const hero = photo
    ? `<img class="seo-recipe-hero" src="${escapeHtml(photo.page)}" alt="${escapeHtml(recipe.title)}" width="1200" height="900" fetchpriority="high" decoding="async">`
    : "";
  const ingredients = (recipe.ingredients || []).map((item) => `<li>${escapeHtml(ingredientLine(item))}</li>`).join("");
  const steps = (recipe.steps || []).map((step, index) => `<li id="step-${index + 1}">${escapeHtml(step)}</li>`).join("");
  return `<section aria-label="Рецепт ${escapeHtml(recipe.title)}">${hero}<h2>Ингредиенты</h2><ul>${ingredients}</ul><h2>Как готовить</h2><ol>${steps}</ol><p><a href="/recipes">Вернуться в базу рецептов</a></p></section>`;
}

function routeNoscript(route, entries) {
  return `<noscript><main style="max-width:920px;margin:40px auto;padding:0 24px;font-family:Arial,sans-serif">${routeContent(route, entries)}</main></noscript>`;
}

function replaceMarker(html, pattern, replacement, markerName, strict = false) {
  if (!pattern.test(html)) {
    if (strict) throw new Error(`SEO marker is missing: ${markerName}`);
    console.error("seo_marker_missing", markerName);
    return html;
  }
  return html.replace(pattern, replacement);
}

function routeBootCopy(html, route, strict = false) {
  const kicker = route.type === "catalog" ? "База Кутно" : "Кутно / рецепт";
  const title = route.type === "catalog" ? "Все рецепты" : route.recipe.title;
  const copy = route.type === "catalog" ? "Открываем полноценную базу рецептов Кутно…" : route.recipe.subtitle || "Открываем рецепт в Кутно…";
  let output = html;
  output = replaceMarker(output, /(<p[^>]*data-seo-kicker[^>]*>)[\s\S]*?(<\/p>)/i, `$1${escapeHtml(kicker)}$2`, "data-seo-kicker", strict);
  output = replaceMarker(output, /(<h1[^>]*data-seo-title[^>]*>)[\s\S]*?(<\/h1>)/i, `$1${escapeHtml(title)}$2`, "data-seo-title", strict);
  output = replaceMarker(output, /(<p[^>]*data-seo-copy[^>]*>)[\s\S]*?(<\/p>)/i, `$1${escapeHtml(copy)}$2`, "data-seo-copy", strict);
  output = replaceMarker(output, /(<div[^>]*data-seo-content[^>]*>)[\s\S]*?(<\/div>)/i, `$1${routeContent(route, route.entries)}$2`, "data-seo-content", strict);
  return output;
}

async function appShell(request, env) {
  const shellUrl = new URL("/", request.url);
  const shellRequest = new Request(shellUrl, { method: "GET", headers: { accept: "text/html", "user-agent": request.headers.get("user-agent") || "" } });
  const response = await env.ASSETS.fetch(shellRequest);
  if (!response.ok) return null;
  return response.text();
}

function publicRouteFor(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const entries = seoRecipeEntries();
  if (url.pathname === "/recipes/") return { redirect: `${SITE_ORIGIN}/recipes` };
  if (url.pathname === "/recipes") return { type: "catalog", pathname: "/recipes", entries };
  if (url.pathname === "/recipe" || url.pathname === "/recipe/") return { redirect: `${SITE_ORIGIN}/recipes` };
  if (!url.pathname.startsWith("/recipe/")) return null;
  if (url.pathname.length > "/recipe/".length && url.pathname.endsWith("/")) return { redirect: canonical(url.pathname.slice(0, -1)) };
  const slug = decodeURIComponent(url.pathname.slice("/recipe/".length));
  const entry = entries.find((item) => item.slug === slug);
  if (!entry) return { missing: true, pathname: url.pathname };
  return { type: "recipe", ...entry, entries };
}

function missingRecipeResponse(request) {
  const html = request.method === "HEAD" ? "" : `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE_ORIGIN}/recipes"><title>Рецепт не найден | Кутно</title></head><body><main><h1>Рецепт не найден</h1><p>Возможно, ссылка устарела. <a href="/recipes">Открыть все рецепты</a>.</p></main></body></html>`;
  return new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "content-language": "ru", "cache-control": "public, max-age=60", "x-robots-tag": "noindex, follow", "x-content-type-options": "nosniff" } });
}

function unavailableRecipeResponse() {
  return new Response("Рецепт временно недоступен", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "30" } });
}

export async function servePublicAppPage(request, env) {
  const route = publicRouteFor(request);
  if (!route) return null;
  if (route.redirect) return Response.redirect(route.redirect, 301);
  if (route.missing) return missingRecipeResponse(request);

  if (route.type === "recipe") {
    const fullRecipe = await loadRecipeBody(request, env, route.id, 2);
    if (!fullRecipe) return unavailableRecipeResponse();
    route.recipe = fullRecipe;
  }

  const shell = await appShell(request, env);
  if (!shell) return null;
  const isRecipe = route.type === "recipe";
  const title = isRecipe ? `${route.recipe.title} — рецепт в Кутно` : "База рецептов Кутно — все рецепты";
  const description = isRecipe ? recipeDescription(route.recipe) : `Полная база Кутно: ${route.entries.length} рецептов с ингредиентами, шагами, временем приготовления и КБЖУ.`;
  const canonicalUrl = canonical(route.pathname);
  const structuredData = isRecipe ? recipeStructuredData(route) : catalogStructuredData(route.entries);
  const photo = isRecipe ? recipeImageSet(route.recipe, route.slug) : null;
  const clientRoute = isRecipe ? { type: "recipe", id: route.id, slug: route.slug, pathname: route.pathname, title: route.recipe.title, hasPhoto: Boolean(photo) } : { type: "catalog", pathname: "/recipes" };
  const strictSeoMarkers = env?.STRICT_SEO_MARKERS === true || env?.STRICT_SEO_MARKERS === "true";

  let html = routeBootCopy(shell, route, strictSeoMarkers);
  html = replaceHeadValue(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceHeadValue(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceHeadValue(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  html = replaceHeadValue(html, /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:type" content="${isRecipe ? "article" : "website"}" />`);
  html = replaceHeadValue(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceHeadValue(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceHeadValue(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = stripHeadMeta(html, /\s*<meta\s+property="og:image(?::(?:width|height))?"[^>]*>\s*/gi);
  html = stripHeadMeta(html, /\s*<meta\s+name="twitter:image"[^>]*>\s*/gi);
  html = replaceHeadValue(html, /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:card" content="${photo ? "summary_large_image" : "summary"}" />`);
  const imageMeta = photo ? [
    `<meta property="og:image" content="${escapeHtml(photo.social)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="675" />`,
    `<meta name="twitter:image" content="${escapeHtml(photo.social)}" />`,
  ].join("\n") : "";
  html = html.replace("</head>", `${imageMeta ? `${imageMeta}\n` : ""}<meta name="robots" content="index,follow,max-image-preview:large" />\n<script type="application/ld+json">${jsonScript(structuredData)}</script>\n<script>window.__KUTNO_PUBLIC_ROUTE__=${jsonScript(clientRoute)};</script>\n</head>`);
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/i, routeNoscript(route, route.entries));

  if (request.method === "HEAD") html = "";
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "content-language": "ru", "cache-control": HTML_CACHE, "x-content-type-options": "nosniff", "x-kutno-public-route": route.type } });
}

export function serveCrawlerRules(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/robots.txt" || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const groups = ["OAI-SearchBot", "GPTBot", "ChatGPT-User", "OAI-AdsBot", "*"];
  const body = `${groups.map((agent) => `User-agent: ${agent}\nAllow: /\nDisallow: /api/\nDisallow: /lite`).join("\n\n")}\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
  return new Response(request.method === "HEAD" ? "" : body, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "cdn-cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
