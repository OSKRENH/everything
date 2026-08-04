import fs from "node:fs";
import { defineConfig } from "vite";

const bridgeSource = fs.readFileSync(new URL("./src/kutno-bridge.inject.js", import.meta.url), "utf8");
const matchingSource = fs.readFileSync(new URL("./src/matching-engine.inject.js", import.meta.url), "utf8");
const fetchResetSource = fs.readFileSync(new URL("./src/fetch-reset.inject.js", import.meta.url), "utf8");
const matchingFixesSource = fs.readFileSync(new URL("./src/matching-fixes.inject.js", import.meta.url), "utf8");
const catalogPerformanceSource = fs.readFileSync(new URL("./src/catalog-performance.inject.js", import.meta.url), "utf8");
const semanticImport = `import {
  analyzeRecipe as semanticAnalyzeRecipe,
  ingredientMatch as semanticIngredientMatch,
  normalizeIngredient as semanticNormalizeIngredient,
  DEFAULT_BASE_INGREDIENTS as SEMANTIC_DEFAULT_BASE_INGREDIENTS,
} from "./ingredient-semantics-v3.js";`;

export default defineConfig({
  plugins: [
    {
      name: "kutno-runtime-bridge",
      enforce: "post",
      transform(code, id) {
        const cleanId = id.split("?", 1)[0];
        if (!cleanId.endsWith("/src/main.js")) return null;
        const consistentMain = code.replace(
          "Соль, воду и масло можно не указывать — мы считаем их базовыми.",
          "Соль, воду, растительное масло и сахар можно не указывать — мы считаем их базовыми.",
        );
        return {
          code: `${semanticImport}\n${consistentMain}\n\n${bridgeSource}\n\nconst kutnoFetchBeforeMatching = window.fetch.bind(window);\n\n${matchingSource}\n\n${fetchResetSource}\n\n${matchingFixesSource}\n\n${catalogPerformanceSource}`,
          map: null,
        };
      },
    },
  ],
});
