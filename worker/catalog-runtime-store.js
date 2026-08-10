let runtimePromise = null;

async function loadFromAssets(request, env) {
  if (!env?.ASSETS?.fetch) return null;
  const url = new URL("/recipe-data/catalog-runtime.json", request?.url || "https://kutno.test/");
  const response = await env.ASSETS.fetch(new Request(url, { method: "GET", headers: { accept: "application/json" } }));
  if (!response.ok) throw new Error(`catalog runtime asset ${response.status}`);
  return response.json();
}

async function loadFromNode() {
  if (typeof process === "undefined" || !process?.versions?.node) return null;
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/recipe-data/catalog-runtime.json", import.meta.url), "utf8");
  return JSON.parse(source);
}

export async function loadRuntimeRecipes(request, env = {}) {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const payload = await loadFromAssets(request, env) || await loadFromNode();
      const recipes = Array.isArray(payload?.recipes) ? payload.recipes : [];
      if (!recipes.length) throw new Error("Catalog runtime is unavailable");
      return recipes;
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}
