import { recipeHasPhoto } from "./recipe-photo-catalog.js";
import { seoRecipeEntries } from "./seo-pages.js";

const SITE_ORIGIN = "https://kutno.ru";
const IMAGE_RATIOS = ["1x1", "4x3", "16x9"];

function cleanSlug(value = "") {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

export function recipeImageUrls(recipe, slugOverride = "") {
  const slug = cleanSlug(slugOverride || recipe?.seoSlug);
  if (!slug || !recipeHasPhoto(recipe, slug)) return [];
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
    if (!recipeHasPhoto(entry.recipe, entry.slug)) return [];
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
