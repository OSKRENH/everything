import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { serveLitePage } from "./worker/lite-page.js";

const bridgeSource = fs.readFileSync(new URL("./src/kutno-bridge.inject.js", import.meta.url), "utf8");
const matchingSource = fs.readFileSync(new URL("./src/matching-engine.inject.js", import.meta.url), "utf8");
const fetchResetSource = fs.readFileSync(new URL("./src/fetch-reset.inject.js", import.meta.url), "utf8");
const matchingFixesSource = fs.readFileSync(new URL("./src/matching-fixes.inject.js", import.meta.url), "utf8");
const catalogPerformanceSource = fs.readFileSync(new URL("./src/catalog-performance.inject.js", import.meta.url), "utf8");
const catalogFacetsSource = fs.readFileSync(new URL("./src/catalog-facets.inject.js", import.meta.url), "utf8");
const swipeFullCatalogSource = fs.readFileSync(new URL("./src/swipe-full-catalog.inject.js", import.meta.url), "utf8");
const matchingCoreV4Source = fs.readFileSync(new URL("./src/matching-core-v4.inject.js", import.meta.url), "utf8");
const kitchenSimplifiedSource = fs.readFileSync(new URL("./src/kitchen-simplified.inject.js", import.meta.url), "utf8");
const rawFeatureSource = fs.readFileSync(new URL("./public/kutno-features.js", import.meta.url), "utf8");
const semanticImport = `import {
  analyzeRecipe as semanticAnalyzeRecipe,
  ingredientMatch as semanticIngredientMatch,
  normalizeIngredient as semanticNormalizeIngredient,
  DEFAULT_BASE_INGREDIENTS as SEMANTIC_DEFAULT_BASE_INGREDIENTS,
} from "./ingredient-semantics-v3.js";
import {
  applyMatchingUserContext as matchingApplyUserContext,
  browserMatchingUserContext,
} from "./matching-user-context.js";
import { kutnoApi } from "./kutno-api.js";`;

function consistentFeatureSource() {
  const oldStaples = '  const BASE_STAPLES = ["соль", "вода", "масло", "перец", "растительное масло", "оливковое масло"];';
  const newStaples = '  const DEFAULT_FEATURE_BASE_STAPLES = ["соль", "вода", "растительное масло", "сахар"];';
  const oldFunction = `  function isStaple(name) {
    const value = normalize(name);
    return BASE_STAPLES.some((staple) => value.includes(normalize(staple)));
  }`;
  const newFunction = `  function configuredFeatureBaseStaples() {
    try {
      const stored = JSON.parse(localStorage.getItem("kutno-base-ingredients-v1"));
      if (Array.isArray(stored) && stored.length) return stored;
    } catch {
      // Используем безопасный набор по умолчанию.
    }
    return DEFAULT_FEATURE_BASE_STAPLES;
  }

  function isStaple(name) {
    let value = normalize(name);
    if (/^масло(?:\\s+(?:для\\s+)?(?:жарки|обжарки|обжаривания))?$/.test(value)) value = "растительное масло";
    return configuredFeatureBaseStaples().some((staple) => {
      const normalizedStaple = normalize(staple);
      return value === normalizedStaple || value.includes(normalizedStaple) || normalizedStaple.includes(value);
    });
  }`;
  const transformed = rawFeatureSource.replace(oldStaples, newStaples).replace(oldFunction, newFunction);
  if (transformed === rawFeatureSource || transformed.includes("BASE_STAPLES.some")) {
    throw new Error("Не удалось синхронизировать базовые продукты в kutno-features.js");
  }
  return transformed;
}

async function sendWebResponse(webResponse, nodeResponse) {
  nodeResponse.statusCode = webResponse.status;
  for (const [name, value] of webResponse.headers) nodeResponse.setHeader(name, value);
  const body = Buffer.from(await webResponse.arrayBuffer());
  nodeResponse.end(body);
}

const featureSource = consistentFeatureSource();
let resolvedConfig;

export default defineConfig({
  plugins: [
    {
      name: "kutno-runtime-bridge",
      enforce: "post",
      transform(code, id) {
        const cleanId = id.split("?", 1)[0];
        if (!cleanId.endsWith("/src/main.js")) return null;
        const consistentMain = code
          .replace(
            "Соль, воду и масло можно не указывать — мы считаем их базовыми.",
            "Соль, воду, растительное масло и сахар можно не указывать — мы считаем их базовыми.",
          )
          .replace(
            "с учётом доступной техники, сложности и числа порций.",
            "с учётом доступной техники и выбранного типа блюда.",
          )
          .replace(
            "Техника, сложность, порции и избранное останутся без изменений.",
            "Техника и избранное останутся без изменений.",
          );
        return {
          code: `${semanticImport}\n${consistentMain}\n\n${bridgeSource}\n\nconst kutnoFetchBeforeMatching = window.fetch.bind(window);\n\n${matchingSource}\n\n${fetchResetSource}\n\n${matchingFixesSource}\n\n${catalogPerformanceSource}\n\n${catalogFacetsSource}\n\n${swipeFullCatalogSource}\n\n${matchingCoreV4Source}\n\n${kitchenSimplifiedSource}`,
          map: null,
        };
      },
    },
    {
      name: "kutno-feature-consistency",
      configResolved(config) {
        resolvedConfig = config;
      },
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = String(request.url || "").split("?", 1)[0];
          if (pathname === "/lite" || pathname === "/lite/recipe") {
            const origin = `http://${request.headers.host || "127.0.0.1"}`;
            const webRequest = new Request(new URL(request.url || pathname, origin), { method: "GET" });
            await sendWebResponse(serveLitePage(webRequest), response);
            return;
          }
          if (pathname !== "/kutno-features.js") return next();
          response.statusCode = 200;
          response.setHeader("content-type", "text/javascript; charset=utf-8");
          response.setHeader("cache-control", "no-store");
          response.end(featureSource);
        });
      },
      closeBundle() {
        if (!resolvedConfig) return;
        const output = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, "kutno-features.js");
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, featureSource, "utf8");
      },
    },
  ],
});
