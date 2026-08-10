import { readFile } from "node:fs/promises";

export function runtimeAssets(shell = "") {
  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(shell, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (url.pathname.startsWith("/recipe-data/")) {
        try {
          const body = await readFile(new URL(`../public${url.pathname}`, import.meta.url));
          return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
        } catch {
          return new Response("asset not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
      }
      return new Response("asset not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    },
  };
}

export function runtimeEnv(shell = "", extra = {}) {
  return { ...extra, ASSETS: runtimeAssets(shell) };
}
