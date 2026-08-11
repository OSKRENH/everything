import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../worker/matching-entry.js", import.meta.url);
let source = await readFile(file, "utf8");
const original = source;

source = source.replace("const FAST_RECIPE_PROFILE_CACHE = new Map();\n", "");

source = source.replace(
  /function fastRecipeProfile\(recipe\) \{[\s\S]*?\n\}\n\nfunction fastTermScore\(recipeTerm, ownedTerm\) \{[\s\S]*?\n\}/,
  `function fastRecipeIndex(recipe) {
  const terms = Array.isArray(recipe?.matchTerms) && recipe.matchTerms.length
    ? recipe.matchTerms
    : (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
      .map((item) => String(item?.name || "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim())
      .filter(Boolean);
  const prefixes = Array.isArray(recipe?.matchPrefixes) && recipe.matchPrefixes.length
    ? recipe.matchPrefixes
    : [...new Set(terms.flatMap((term) => fastPrefixes(term)))];
  return { terms, prefixes };
}

function fastRecipeScore(recipe, ownedTerm) {
  const index = fastRecipeIndex(recipe);
  if (index.terms.includes(ownedTerm.term)) return 6;
  for (const term of index.terms) {
    if (term.length >= 4 && ownedTerm.term.length >= 4 && (term.includes(ownedTerm.term) || ownedTerm.term.includes(term))) return 4;
  }
  return ownedTerm.prefixes.some((prefix) => index.prefixes.includes(prefix)) ? 1 : 0;
}`,
);

source = source.replace(
  /      const terms = fastRecipeProfile\(recipe\);\n      let score = 0;[\s\S]*?\n      return \{ recipe, index, score \};/,
  `      let score = 0;
      for (const ownedTerm of owned) score += fastRecipeScore(recipe, ownedTerm);
      return { recipe, index, score };`,
);

if (source === original) throw new Error("matching-entry.js patch did not change the source");
if (/FAST_RECIPE_PROFILE_CACHE|fastRecipeProfile\(/.test(source)) throw new Error("lazy runtime profile building is still present");
if (!/fastRecipeScore\(recipe, ownedTerm\)/.test(source)) throw new Error("precomputed matcher path was not installed");

await writeFile(file, source);
console.log("Patched worker/matching-entry.js to consume precomputed matchTerms/matchPrefixes.");
