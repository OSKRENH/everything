import { CATALOG_VERSION } from "./catalog-version.js";
import { RECIPE_PHOTO_CATALOG, recipeHasPhoto } from "./recipe-photo-catalog.js";
import { seoRecipeEntries } from "./seo-pages.js";

const SITE_ORIGIN = "https://kutno.ru";
const IMAGE_RATIOS = ["1x1", "4x3", "16x9"];
const PHOTO_API_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";
const THUMB_CACHE = "public, max-age=86400, s-maxage=2592000, immutable";
const LEGACY_RECIPE_PHOTO_COUNT = 119;
const INSET_RECIPE_PHOTO_IDS = new Set(
  RECIPE_PHOTO_CATALOG.slice(LEGACY_RECIPE_PHOTO_COUNT).map((item) => String(item.id || "")).filter(Boolean),
);

function cleanSlug(value = "") {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

const PHOTO_SLUG_BY_ID = new Map(RECIPE_PHOTO_CATALOG.map((item) => [String(item.id || ""), cleanSlug(item.slug)]).filter(([id, slug]) => id && slug));

export function recipePhotoSlug(recipe, slugOverride = "") {
  const explicit = cleanSlug(slugOverride || recipe?.seoSlug);
  if (explicit && recipeHasPhoto(recipe, explicit)) return explicit;
  const id = String(recipe?.id || recipe?.source?.id || "").trim();
  return id ? PHOTO_SLUG_BY_ID.get(id) || "" : "";
}

export function recipeImageUrls(recipe, slugOverride = "") {
  const slug = recipePhotoSlug(recipe, slugOverride);
  if (!slug) return [];
  return IMAGE_RATIOS.map((ratio) => `${SITE_ORIGIN}/img/${slug}-${ratio}.webp`);
}

export function recipeThumbnailUrl(recipe, slugOverride = "") {
  const slug = recipePhotoSlug(recipe, slugOverride);
  return slug ? `${SITE_ORIGIN}/img/${slug}-thumb.webp` : "";
}

export function recipeImageSet(recipe, slugOverride = "") {
  const urls = recipeImageUrls(recipe, slugOverride);
  if (!urls.length) return null;
  return {
    thumb: recipeThumbnailUrl(recipe, slugOverride),
    square: urls[0],
    page: urls[1],
    social: urls[2],
  };
}

export function recipePhotoManifest(portions = 2) {
  return seoRecipeEntries(portions).flatMap((entry) => {
    const slug = recipePhotoSlug(entry.recipe, entry.slug);
    if (!slug) return [];
    return [{
      id: entry.id,
      title: entry.recipe.title,
      slug,
      inset: INSET_RECIPE_PHOTO_IDS.has(String(entry.id || "")),
    }];
  });
}

export function serveRecipePhotoManifest(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/photo-manifest" || !["GET", "HEAD"].includes(request.method)) return null;
  const photos = recipePhotoManifest(2);
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ photos, catalogVersion: CATALOG_VERSION }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": PHOTO_API_CACHE,
      "x-content-type-options": "nosniff",
    },
  });
}

function thumbnailSlug(pathname) {
  const match = String(pathname || "").match(/^\/img\/([a-z0-9]+(?:-[a-z0-9]+)*)-thumb\.webp$/);
  if (!match) return "";
  const slug = cleanSlug(match[1]);
  return slug && recipeHasPhoto({}, slug) ? slug : "";
}

function thumbnailResponse(response, request) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", THUMB_CACHE);
  headers.set("x-content-type-options", "nosniff");
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function serveRecipeThumbnail(request, env = {}) {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  const url = new URL(request.url);
  const slug = thumbnailSlug(url.pathname);
  if (!slug) return null;

  const sourcePath = `/img/${slug}-1x1.webp`;
  const transformUrl = new URL(`/cdn-cgi/image/width=400,height=400,fit=cover,format=webp,quality=82${sourcePath}`, url);
  try {
    const transformed = await fetch(new Request(transformUrl, { method: request.method, headers: { accept: "image/webp,image/*;q=0.8" } }));
    if (transformed.ok) return thumbnailResponse(transformed, request);
  } catch {
    // Если Image Transformations недоступен, ниже остаётся безопасный оригинал.
  }

  if (!env?.ASSETS?.fetch) return new Response("thumbnail unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  const sourceUrl = new URL(sourcePath, url);
  const source = await env.ASSETS.fetch(new Request(sourceUrl, { method: request.method, headers: request.headers }));
  return thumbnailResponse(source, request);
}
