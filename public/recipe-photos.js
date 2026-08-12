const PHOTO_MANIFEST_URL = "/api/photo-manifest";
const PHOTO_RATIOS = {
  square: { suffix: "1x1", width: 1200, height: 1200 },
  page: { suffix: "4x3", width: 1200, height: 900 },
};

let photoManifestPromise = null;

function normalizePhotoTitle(value = "") {
  return String(value || "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

function loadPhotoManifest() {
  if (!photoManifestPromise) {
    photoManifestPromise = fetch(PHOTO_MANIFEST_URL, { headers: { accept: "application/json" } })
      .then((response) => response.ok ? response.json() : { photos: [] })
      .then((data) => Array.isArray(data?.photos) ? data.photos : [])
      .catch(() => []);
  }
  return photoManifestPromise;
}

function photoUrl(slug, ratio) {
  const meta = PHOTO_RATIOS[ratio];
  if (!meta || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ""))) return "";
  return `/img/${slug}-${meta.suffix}.webp`;
}

function createPhoto(slug, ratio, { hero = false, inset = false } = {}) {
  const meta = PHOTO_RATIOS[ratio];
  const url = photoUrl(slug, ratio);
  if (!meta || !url) return null;
  const figure = document.createElement("figure");
  figure.className = `kutno-recipe-photo ${hero ? "kutno-recipe-photo--hero" : "kutno-recipe-photo--card"}${inset ? " kutno-recipe-photo--inset" : ""}`;
  figure.dataset.recipePhoto = slug;
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.width = meta.width;
  image.height = meta.height;
  image.decoding = "async";
  if (hero) image.fetchPriority = "high";
  else image.loading = "lazy";
  image.addEventListener("error", () => figure.remove(), { once: true });
  figure.append(image);
  return figure;
}

function manifestIndexes(photos) {
  return {
    byId: new Map(photos.map((item) => [String(item?.id || ""), item]).filter(([id]) => id)),
    byTitle: new Map(photos.map((item) => [normalizePhotoTitle(item?.title), item]).filter(([title]) => title)),
  };
}

function recipeId(recipe) {
  try {
    return String(window.kutnoBridge?.getRecipeId?.(recipe) || recipe?.id || recipe?.source?.id || "");
  } catch {
    return String(recipe?.id || recipe?.source?.id || "");
  }
}

function syncHero(indexes) {
  const sheet = document.querySelector(".recipe-sheet");
  if (!sheet || sheet.querySelector(":scope > .kutno-recipe-photo--hero")) return;
  const current = window.kutnoBridge?.getCurrentRecipe?.();
  const recipe = current?.recipe;
  if (!recipe) return;
  const item = indexes.byId.get(recipeId(recipe)) || indexes.byTitle.get(normalizePhotoTitle(recipe.title));
  if (!item?.slug) return;
  const photo = createPhoto(item.slug, "page", { hero: true, inset: item.inset === true });
  if (photo) sheet.querySelector(":scope > .sheet-topline")?.insertAdjacentElement("afterend", photo);
}

function attachCardPhoto(card, photo) {
  if (!card.matches(".recipe-entry")) {
    card.prepend(photo);
    return;
  }

  const number = card.querySelector(":scope > .recipe-number");
  if (!number) {
    card.prepend(photo);
    return;
  }

  const marker = document.createElement("div");
  marker.className = "kutno-recipe-marker";
  number.replaceWith(marker);
  marker.append(photo, number);
}

function syncCards(indexes) {
  document.querySelectorAll("article").forEach((card) => {
    if (card.querySelector(".kutno-recipe-photo--card")) return;
    const opener = card.querySelector("[data-open-recipe]");
    if (!opener) return;
    const title = normalizePhotoTitle(opener.textContent);
    if (!title) return;
    const item = indexes.byTitle.get(title);
    if (!item?.slug) return;
    const photo = createPhoto(item.slug, "square", { inset: item.inset === true });
    if (photo) attachCardPhoto(card, photo);
  });
}

async function syncRecipePhotos() {
  const photos = await loadPhotoManifest();
  if (!photos.length) return;
  const indexes = manifestIndexes(photos);
  syncHero(indexes);
  syncCards(indexes);
}

const observer = new MutationObserver(() => queueMicrotask(syncRecipePhotos));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("kutno:ready", syncRecipePhotos);
window.addEventListener("kutno:bridge-ready", syncRecipePhotos);
syncRecipePhotos();
