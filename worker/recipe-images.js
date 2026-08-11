import { RECIPE_PHOTO_CATALOG, recipeHasPhoto } from "./recipe-photo-catalog.js";
import { seoRecipeEntries } from "./seo-pages.js";

const SITE_ORIGIN = "https://kutno.ru";
const IMAGE_RATIOS = ["1x1", "4x3", "16x9"];

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
    const slug = recipePhotoSlug(entry.recipe, entry.slug);
    if (!slug) return [];
    return [{ id: entry.id, title: entry.recipe.title, slug }];
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
      "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600",
      "x-content-type-options": "nosniff",
    },
  });
}