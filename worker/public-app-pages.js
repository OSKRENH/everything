import { seoRecipeEntries } from "./seo-pages.js";

const SITE_ORIGIN = "https://kutno.ru";
const HTML_CACHE = "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  const nutrition = recipe?.nutrition || {};
  const portions = Math.max(1, Number(recipe?.portions) || 2);
  const recipeData = {
    "@type": "Recipe",
    "@id": `${url}#recipe`,
    name: cleanText(recipe.title, 180),
    description: recipeDescription(recipe),
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: "Кутно", url: SITE_ORIGIN },
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

function routeNoscript(route, entries) {
  if (route.type === "catalog") {
    const links = entries.map((entry) => `<li><a href="${escapeHtml(entry.pathname)}">${escapeHtml(entry.recipe.title)}</a></li>`).join("");
    return `<noscript><main style="max-width:920px;margin:40px auto;padding:0 24px;font-family:Arial,sans-serif"><h1>База рецептов Кутно</h1><p>Для интерактивной версии нужен JavaScript. Все рецепты доступны по отдельным адресам:</p><ul>${links}</ul></main></noscript>`;
  }
  const recipe = route.recipe;
  const ingredients = (recipe.ingredients || []).map((item) => `<li>${escapeHtml(ingredientLine(item))}</li>`).join("");
  const steps = (recipe.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `<noscript><main style="max-width:920px;margin:40px auto;padding:0 24px;font-family:Arial,sans-serif"><a href="/recipes">База рецептов</a><h1>${escapeHtml(recipe.title)}</h1><p>${escapeHtml(recipeDescription(recipe))}</p><h2>Ингредиенты</h2><ul>${ingredients}</ul><h2>Как готовить</h2><ol>${steps}</ol></main></noscript>`;
}

function routeBootCopy(html, route) {
  if (route.type === "catalog") {
    return html
      .replace("<p class=\"boot-kicker\">Рецепты из того, что есть</p>", "<p class=\"boot-kicker\">База Кутно</p>")
      .replace("<h1>Что приготовить сегодня</h1>", "<h1>Все рецепты</h1>")
      .replace("Подготавливаем кухню и базу рецептов. Первый экран уже работает без загрузки приложения.", "Открываем полноценную базу рецептов Кутно…");
  }
  return html
    .replace("<p class=\"boot-kicker\">Рецепты из того, что есть</p>", `<p class=\"boot-kicker\">Кутно / рецепт</p>`)
    .replace("<h1>Что приготовить сегодня</h1>", `<h1>${escapeHtml(route.recipe.title)}</h1>`)
    .replace("Подготавливаем кухню и базу рецептов. Первый экран уже работает без загрузки приложения.", escapeHtml(route.recipe.subtitle || "Открываем рецепт в Кутно…"));
}

async function appShell(request, env) {
  const shellUrl = new URL("/", request.url);
  const shellRequest = new Request(shellUrl, {
    method: "GET",
    headers: { accept: "text/html", "user-agent": request.headers.get("user-agent") || "" },
  });
  const response = await env.ASSETS.fetch(shellRequest);
  if (!response.ok) return null;
  return response.text();
}

function publicRouteFor(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const entries = seoRecipeEntries(2);
  if (url.pathname === "/recipes/") return { redirect: `${SITE_ORIGIN}/recipes` };
  if (url.pathname === "/recipes") return { type: "catalog", pathname: "/recipes", entries };
  if (!url.pathname.startsWith("/recipe/")) return null;
  if (url.pathname.length > "/recipe/".length && url.pathname.endsWith("/")) {
    return { redirect: canonical(url.pathname.slice(0, -1)) };
  }
  const slug = decodeURIComponent(url.pathname.slice("/recipe/".length));
  const entry = entries.find((item) => item.slug === slug);
  if (!entry) return { missing: true };
  return { type: "recipe", ...entry, entries };
}

export async function servePublicAppPage(request, env) {
  const route = publicRouteFor(request);
  if (!route) return null;
  if (route.redirect) return Response.redirect(route.redirect, 301);
  if (route.missing) return null;

  const shell = await appShell(request, env);
  if (!shell) return null;
  const isRecipe = route.type === "recipe";
  const title = isRecipe ? `${route.recipe.title} — рецепт в Кутно` : "База рецептов Кутно — все рецепты";
  const description = isRecipe
    ? recipeDescription(route.recipe)
    : `Полная база Кутно: ${route.entries.length} рецептов с ингредиентами, шагами, временем приготовления и КБЖУ.`;
  const canonicalUrl = canonical(route.pathname);
  const structuredData = isRecipe ? recipeStructuredData(route) : catalogStructuredData(route.entries);
  const clientRoute = isRecipe
    ? { type: "recipe", id: route.id, slug: route.slug, pathname: route.pathname, title: route.recipe.title }
    : { type: "catalog", pathname: "/recipes" };

  let html = routeBootCopy(shell, route);
  html = replaceHeadValue(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceHeadValue(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceHeadValue(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  html = replaceHeadValue(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceHeadValue(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceHeadValue(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = html.replace("</head>", `<meta name="robots" content="index,follow,max-image-preview:large" />\n<script type="application/ld+json">${jsonScript(structuredData)}</script>\n<script>window.__KUTNO_PUBLIC_ROUTE__=${jsonScript(clientRoute)};</script>\n</head>`);
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/i, routeNoscript(route, route.entries));

  if (request.method === "HEAD") html = "";
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-language": "ru",
      "cache-control": HTML_CACHE,
      "x-content-type-options": "nosniff",
      "x-kutno-public-route": route.type,
    },
  });
}

export function serveCrawlerRules(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/robots.txt" || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const groups = ["OAI-SearchBot", "GPTBot", "ChatGPT-User", "OAI-AdsBot", "*"];
  const body = `${groups.map((agent) => `User-agent: ${agent}\nAllow: /\nDisallow: /api/\nDisallow: /lite`).join("\n\n")}\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
  return new Response(request.method === "HEAD" ? "" : body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=900, s-maxage=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
