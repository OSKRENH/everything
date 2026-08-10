import { catalogSources, fullRecipeForSource, sourceIdentity } from "./catalog-page.js";

const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

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

export function seoRecipeEntries(portions = 2) {
  const usedSlugs = new Map();
  return catalogSources(portions).map((source) => {
    const recipe = fullRecipeForSource(source, portions);
    if (!recipe?.title) return null;
    const baseSlug = seoSlug(recipe.title || sourceIdentity(source.kind, source.recipe));
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
  }).filter(Boolean);
}
