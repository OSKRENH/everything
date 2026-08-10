import assert from "node:assert/strict";
import test from "node:test";
import { servePublicAppPage } from "../worker/public-app-pages.js";

function envFor(shell, strict = false) {
  return {
    STRICT_SEO_MARKERS: strict,
    ASSETS: {
      async fetch() {
        return new Response(shell, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      },
    },
  };
}

const brokenShell = "<!doctype html><html><head><title>Кутно</title></head><body><main>shell without seo markers</main></body></html>";

test("прод не превращает отсутствие SEO-маркера в 500", async () => {
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipes"), envFor(brokenShell));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /shell without seo markers/);
  assert.match(html, /application\/ld\+json/);
});

test("строгий режим ловит отсутствие SEO-маркера до прода", async () => {
  await assert.rejects(
    () => servePublicAppPage(new Request("https://kutno.ru/recipes"), envFor(brokenShell, true)),
    /SEO marker is missing: data-seo-kicker/,
  );
});

test("HTML больше не может сутки висеть stale", async () => {
  const shell = "<!doctype html><html><head><title>Кутно</title></head><body><p data-seo-kicker></p><h1 data-seo-title></h1><p data-seo-copy></p><div data-seo-content></div><noscript></noscript></body></html>";
  const response = await servePublicAppPage(new Request("https://kutno.ru/recipes"), envFor(shell));
  const cache = response.headers.get("cache-control") || "";
  assert.match(cache, /stale-while-revalidate=600/);
  assert.doesNotMatch(cache, /86400/);
});
