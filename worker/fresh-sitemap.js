import { seoRecipeEntries } from "./seo-pages.js";
import { recipeImageSet } from "./recipe-images.js";

const SITE_ORIGIN = "https://kutno.ru";
const LAST_MODIFIED = "2026-09-01";

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function canonicalSitemapUrls(entries = seoRecipeEntries()) {
  const paths = ["/", "/recipes", ...entries.map((entry) => entry.pathname)];
  return [...new Set(paths)].flatMap((pathname) => {
    const url = new URL(pathname, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || url.protocol !== "https:" || url.search || url.hash) return [];
    if (url.pathname !== "/" && url.pathname.endsWith("/")) return [];
    return [url.toString()];
  });
}

function sitemapEntryByUrl(entries = seoRecipeEntries()) {
  return new Map(entries.map((entry) => [canonicalSitemapUrls([entry]).at(-1), entry]));
}

export function serveFreshSitemap(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/sitemap.xml" || !["GET", "HEAD"].includes(request.method)) return null;
  const entries = seoRecipeEntries();
  const urls = canonicalSitemapUrls(entries);
  const recipes = sitemapEntryByUrl(entries);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map((entry) => {
    const recipeEntry = recipes.get(entry);
    const image = recipeEntry ? recipeImageSet(recipeEntry.recipe, recipeEntry.slug) : null;
    const imageXml = image ? `<image:image><image:loc>${escapeXml(image.page)}</image:loc><image:title>${escapeXml(recipeEntry.recipe.title)}</image:title></image:image>` : "";
    return `  <url><loc>${escapeXml(entry)}</loc><lastmod>${LAST_MODIFIED}</lastmod>${imageXml}</url>`;
  }).join("\n")}\n</urlset>\n`;
  return new Response(request.method === "HEAD" ? "" : body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store",
      "cdn-cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
