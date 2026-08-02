import fs from "node:fs";
import { defineConfig } from "vite";

const bridgeSource = fs.readFileSync(new URL("./src/kutno-bridge.inject.js", import.meta.url), "utf8");
const matchingSource = fs.readFileSync(new URL("./src/matching-engine.inject.js", import.meta.url), "utf8");
const matchingFixesSource = fs.readFileSync(new URL("./src/matching-fixes.inject.js", import.meta.url), "utf8");
const semanticImport = `import {
  analyzeRecipe as semanticAnalyzeRecipe,
  ingredientMatch as semanticIngredientMatch,
  normalizeIngredient as semanticNormalizeIngredient,
  DEFAULT_BASE_INGREDIENTS as SEMANTIC_DEFAULT_BASE_INGREDIENTS,
} from "./ingredient-semantics-v2.js";`;

export default defineConfig({
  plugins: [
    {
      name: "kutno-runtime-bridge",
      enforce: "post",
      transform(code, id) {
        const cleanId = id.split("?", 1)[0];
        if (!cleanId.endsWith("/src/main.js")) return null;
        return {
          code: `${semanticImport}\n${code}\n\n${bridgeSource}\n\n${matchingSource}\n\n${matchingFixesSource}`,
          map: null,
        };
      },
    },
  ],
});
