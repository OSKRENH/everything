import { seoRecipeEntries } from "./seo-pages.js";

const SITE_ORIGIN = "https://kutno.ru";
const IMAGE_RATIOS = ["1x1", "4x3", "16x9"];

function cleanSlug(value = "") {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

export function recipeImageUrls(recipe, slugOverride = "") {
  if (recipe?.hasPhoto !== true) return [];
  const slug = cleanSlug(slugOverride || recipe?.seoSlug);
  if (!slug) return [];
  return IMAGE_RATIOS.map((ratio) => `${SITE_ORIGIN}/img/${slug}-${ratio}.webp`);
}

export function recipeImageSet(recipe, slugOverride = "") {
  const urls = recipeImageUrls(recipe, slugOverride);
  if (!urls.length) return null;
  return {
    square: urls[0],
    page: urls[1],
    social: urls[2],
  };
}

export function recipePhotoManifest(portions = 2) {
  return seoRecipeEntries(portions).flatMap((entry) => {
    if (entry.source?.recipe?.hasPhoto !== true) return [];
    return [{ id: entry.id, title: entry.recipe.title, slug: entry.slug }];
  });
}

export function serveRecipePhotoManifest(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/photo-manifest" || !["GET", "HEAD"].includes(request.method)) return null;
  const photos = recipePhotoManifest(2);
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ photos }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=600",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function serveRecipeImage(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/img/") || !["GET", "HEAD"].includes(request.method)) return null;
  const key = decodeURIComponent(url.pathname.slice("/img/".length));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-(?:1x1|4x3|16x9)\.webp$/.test(key)) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  if (!env?.IMAGES) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const object = await env.IMAGES.get(key);
  if (!object) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  headers.set("content-type", headers.get("content-type") || "image/webp");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
}
