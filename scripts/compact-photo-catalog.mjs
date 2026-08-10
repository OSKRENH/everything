import { writeFileSync } from "node:fs";
import { RECIPE_PHOTO_CATALOG } from "../worker/recipe-photo-catalog.js";

const pairs = RECIPE_PHOTO_CATALOG.map(({ id, slug }) => [String(id || ""), String(slug || "")]);
if (pairs.length !== 119 || pairs.some(([id, slug]) => !id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
  throw new Error("Unexpected recipe photo catalog before compaction");
}
const uniqueIds = new Set(pairs.map(([id]) => id));
const uniqueSlugs = new Set(pairs.map(([, slug]) => slug));
if (uniqueIds.size !== pairs.length || uniqueSlugs.size !== pairs.length) throw new Error("Duplicate photo catalog entry");

const body = `// Generated from the approved recipe illustration archive. Runtime truth is intentionally compact: id + slug only.\nconst RECIPE_PHOTO_PAIRS = Object.freeze(${JSON.stringify(pairs, null, 2)});\n\nexport const RECIPE_PHOTO_CATALOG = Object.freeze(RECIPE_PHOTO_PAIRS.map(([id, slug]) => Object.freeze({ id, slug })));\n\nconst PHOTO_IDS = new Set(RECIPE_PHOTO_PAIRS.map(([id]) => id));\nconst PHOTO_SLUGS = new Set(RECIPE_PHOTO_PAIRS.map(([, slug]) => slug));\n\nexport function recipeHasPhoto(recipe, slug = \"\") {\n  const id = String(recipe?.id || recipe?.source?.id || \"\").trim();\n  const normalizedSlug = String(slug || recipe?.seoSlug || \"\").trim().toLowerCase();\n  return Boolean((id && PHOTO_IDS.has(id)) || (normalizedSlug && PHOTO_SLUGS.has(normalizedSlug)));\n}\n`;
writeFileSync(new URL("../worker/recipe-photo-catalog.js", import.meta.url), body);
console.log(`Compacted ${pairs.length} photo records.`);
