import { seoRecipeEntries } from "./seo-pages.js";

const SITE_ORIGIN = "https://kutno.ru";
const LAST_MODIFIED = "2026-08-17";

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function serveFreshSitemap(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/sitemap.xml" || !["GET", "HEAD"].includes(request.method)) return null;
  const entries = seoRecipeEntries(2);
  const urls = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/recipes`, ...entries.map((entry) => `${SITE_ORIGIN}${entry.pathname}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((entry) => `  <url><loc>${escapeXml(entry)}</loc><lastmod>${LAST_MODIFIED}</lastmod></url>`).join("\n")}\n</urlset>\n`;
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
