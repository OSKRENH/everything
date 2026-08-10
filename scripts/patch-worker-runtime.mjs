import { readFile, writeFile } from "node:fs/promises";

const indexUrl = new URL("../worker/index.js", import.meta.url);
let index = await readFile(indexUrl, "utf8");
const oldImport = 'import { CATALOG_VERSION, INGREDIENT_GLOSSARY, WORLD_RECIPE_CATALOG } from "./recipe-catalog.js";';
const newImport = 'import { CATALOG_VERSION, RUNTIME_RECIPES } from "./generated/catalog-runtime.js";\nimport { INGREDIENT_GLOSSARY } from "./generated/glossary-runtime.js";';
if (index.includes(oldImport)) index = index.replace(oldImport, newImport);
index = index.replaceAll("WORLD_RECIPE_CATALOG", "RUNTIME_RECIPES");
await writeFile(indexUrl, index);
console.log("worker/index.js switched to generated runtime catalog.");
