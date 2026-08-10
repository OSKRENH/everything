import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
};
function replaceOnce(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: replacement source not found`);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${file}: expected 1 replacement, got ${count}`);
  write(file, source.replace(before, after));
}

const imgDir = path.join(root, "public", "img");
if (!fs.existsSync(imgDir)) throw new Error("public/img is missing");
const names = fs.readdirSync(imgDir, { withFileTypes: true });
if (names.some((entry) => !entry.isFile())) throw new Error("public/img must be flat");
const imageNames = names.map((entry) => entry.name).sort();
if (imageNames.length !== 357) throw new Error(`Expected 357 images, got ${imageNames.length}`);

const bySlug = new Map();
for (const name of imageNames) {
  const match = name.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)-(1x1|4x3|16x9)\.webp$/);
  if (!match) throw new Error(`Unexpected image name: ${name}`);
  const [, slug, ratio] = match;
  if (!bySlug.has(slug)) bySlug.set(slug, new Set());
  bySlug.get(slug).add(ratio);
}
if (bySlug.size !== 119) throw new Error(`Expected 119 image slugs, got ${bySlug.size}`);
for (const [slug, ratios] of bySlug) {
  for (const ratio of ["1x1", "4x3", "16x9"]) {
    if (!ratios.has(ratio)) throw new Error(`${slug}: missing ${ratio}`);
  }
}

const { seoRecipeEntries } = await import(pathToFileURL(path.join(root, "worker", "seo-pages.js")).href);
const entries = seoRecipeEntries(2);
const entriesBySlug = new Map(entries.map((entry) => [entry.slug, entry]));
const photoEntries = [...bySlug.keys()].sort().map((slug) => {
  const entry = entriesBySlug.get(slug);
  if (!entry) throw new Error(`Image slug has no recipe: ${slug}`);
  return { id: String(entry.id), title: String(entry.recipe.title), slug };
});
if (photoEntries.length !== 119) throw new Error(`Expected 119 catalog entries, got ${photoEntries.length}`);
if (new Set(photoEntries.map((entry) => entry.id)).size !== photoEntries.length) {
  throw new Error("Photo catalog contains duplicate recipe ids");
}

const catalogSource = `// Generated from the approved recipe illustration archive. Keep this list explicit and independent from generated hasPhoto flags.
export const RECIPE_PHOTO_CATALOG = Object.freeze(${JSON.stringify(photoEntries, null, 2)});

const PHOTO_SLUGS = new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.slug));
const PHOTO_IDS = new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.id));

function cleanSlug(value = "") {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

export function recipeHasPhoto(recipe, slugOverride = "") {
  const slug = cleanSlug(slugOverride || recipe?.seoSlug);
  if (slug && PHOTO_SLUGS.has(slug)) return true;
  const id = String(recipe?.id || recipe?.source?.id || "").trim();
  return Boolean(id && PHOTO_IDS.has(id));
}
`;
write("worker/recipe-photo-catalog.js", catalogSource);

write("worker/recipe-images.js", `import { recipeHasPhoto } from "./recipe-photo-catalog.js";
import { seoRecipeEntries } from "./seo-pages.js";

const SITE_ORIGIN = "https://kutno.ru";
const IMAGE_RATIOS = ["1x1", "4x3", "16x9"];

function cleanSlug(value = "") {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

export function recipeImageUrls(recipe, slugOverride = "") {
  const slug = cleanSlug(slugOverride || recipe?.seoSlug);
  if (!slug || !recipeHasPhoto(recipe, slug)) return [];
  return IMAGE_RATIOS.map((ratio) => \`${SITE_ORIGIN}/img/\${slug}-\${ratio}.webp\`);
}

export function recipeImageSet(recipe, slugOverride = "") {
  const urls = recipeImageUrls(recipe, slugOverride);
  if (!urls.length) return null;
  return {
    square: urls[0],
    page: urls[1],
    social: urls[2],
  };
}

export function recipePhotoManifest(portions = 2) {
  return seoRecipeEntries(portions).flatMap((entry) => {
    if (!recipeHasPhoto(entry.recipe, entry.slug)) return [];
    return [{ id: entry.id, title: entry.recipe.title, slug: entry.slug }];
  });
}

export function serveRecipePhotoManifest(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/photo-manifest" || !["GET", "HEAD"].includes(request.method)) return null;
  const photos = recipePhotoManifest(2);
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ photos }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=600",
      "x-content-type-options": "nosniff",
    },
  });
}
`);

replaceOnce(
  "worker/routes.js",
  'import { serveRecipeImage, serveRecipePhotoManifest } from "./recipe-images.js";',
  'import { serveRecipePhotoManifest } from "./recipe-images.js";',
);
replaceOnce(
  "worker/routes.js",
  '  prefix("/img/", ["GET", "HEAD"], "recipe-image", ({ request, env }) => serveRecipeImage(request, env)),\n',
  "",
);

replaceOnce(
  "worker/public-app-pages.js",
  '  const images = recipeImageUrls({ hasPhoto: entry.source?.recipe?.hasPhoto === true }, entry.slug);',
  '  const images = recipeImageUrls(entry.recipe, entry.slug);',
);
replaceOnce(
  "worker/public-app-pages.js",
  '  const photo = isRecipe ? recipeImageSet({ hasPhoto: route.source?.recipe?.hasPhoto === true }, route.slug) : null;',
  '  const photo = isRecipe ? recipeImageSet(route.recipe, route.slug) : null;',
);

replaceOnce(
  "wrangler.jsonc",
  '      "/img/*",\n',
  "",
);

const headersRule = `/img/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400
  X-Content-Type-Options: nosniff`;
let headers = read("public/_headers").trimEnd();
if (!headers.includes("/img/*")) headers += `\n\n${headersRule}\n`;
write("public/_headers", headers);

if (!fs.existsSync(path.join(root, ".gitignore"))) {
  write(".gitignore", "node_modules/\ndist/\n.wrangler/\nplaywright-report/\ntest-results/\n");
} else {
  let ignore = read(".gitignore").trimEnd().split(/\r?\n/);
  for (const line of ["node_modules/", "dist/"]) if (!ignore.includes(line)) ignore.push(line);
  write(".gitignore", `${ignore.join("\n")}\n`);
}

write("scripts/check-static-recipe-assets.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED = {
  "1x1": [1200, 1200],
  "4x3": [1200, 900],
  "16x9": [1200, 675],
};

function uint24le(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

export function webpDimensions(buffer) {
  assert.ok(buffer.length > 20, "WebP file is too small");
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF", "missing RIFF header");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP", "missing WEBP signature");
  assert.equal(buffer.readUInt32LE(4) + 8, buffer.length, "RIFF length does not match file length");

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourcc = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    const end = data + size;
    assert.ok(end <= buffer.length, \`truncated \${fourcc} chunk\`);

    if (fourcc === "VP8X") {
      assert.ok(size >= 10, "invalid VP8X chunk");
      return [uint24le(buffer, data + 4) + 1, uint24le(buffer, data + 7) + 1];
    }
    if (fourcc === "VP8 ") {
      assert.ok(size >= 10, "invalid VP8 chunk");
      assert.equal(buffer[data + 3], 0x9d, "invalid VP8 frame marker");
      assert.equal(buffer[data + 4], 0x01, "invalid VP8 frame marker");
      assert.equal(buffer[data + 5], 0x2a, "invalid VP8 frame marker");
      return [buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff];
    }
    if (fourcc === "VP8L") {
      assert.ok(size >= 5, "invalid VP8L chunk");
      assert.equal(buffer[data], 0x2f, "invalid VP8L signature");
      const bits = buffer.readUInt32LE(data + 1);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    offset = end + (size & 1);
  }
  throw new Error("No VP8/VP8L/VP8X image chunk found");
}

export function checkImageDirectory(directory) {
  const absolute = path.resolve(directory);
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  assert.equal(entries.length, 357, \`${directory}: expected 357 files\`);
  assert.ok(entries.every((entry) => entry.isFile()), \`${directory}: nested folders are not allowed\`);

  const bySlug = new Map();
  for (const entry of entries) {
    const match = entry.name.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)-(1x1|4x3|16x9)\\.webp$/);
    assert.ok(match, \`${directory}: invalid filename \${entry.name}\`);
    const [, slug, ratio] = match;
    const file = path.join(absolute, entry.name);
    const stat = fs.statSync(file);
    assert.ok(stat.size > 0, \`${entry.name}: zero-byte image\`);
    const dimensions = webpDimensions(fs.readFileSync(file));
    assert.deepEqual(dimensions, EXPECTED[ratio], \`${entry.name}: wrong dimensions\`);
    if (!bySlug.has(slug)) bySlug.set(slug, new Set());
    bySlug.get(slug).add(ratio);
  }

  assert.equal(bySlug.size, 119, \`${directory}: expected 119 slugs\`);
  for (const [slug, ratios] of bySlug) {
    assert.deepEqual([...ratios].sort(), ["16x9", "1x1", "4x3"].sort(), \`${slug}: incomplete image set\`);
  }
  return bySlug;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const directory = process.argv[2] || "public/img";
  const slugs = checkImageDirectory(directory);
  console.log(\`Verified \${slugs.size} recipe image sets / 357 WebP files in \${directory}\`);
}
`);

write("test/static-recipe-assets.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { checkImageDirectory } from "../scripts/check-static-recipe-assets.mjs";
import { RECIPE_PHOTO_CATALOG, recipeHasPhoto } from "../worker/recipe-photo-catalog.js";
import { recipeImageUrls, recipePhotoManifest } from "../worker/recipe-images.js";
import { seoRecipeEntries } from "../worker/seo-pages.js";

test("public/img содержит ровно 119 полных троек валидных WebP", () => {
  const slugs = checkImageDirectory("public/img");
  assert.equal(slugs.size, 119);
});

test("фотокаталог содержит ровно 119 существующих рецептов и slug", () => {
  assert.equal(RECIPE_PHOTO_CATALOG.length, 119);
  assert.equal(new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.id)).size, 119);
  assert.equal(new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.slug)).size, 119);

  const entries = seoRecipeEntries(2);
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  for (const photo of RECIPE_PHOTO_CATALOG) {
    const recipe = bySlug.get(photo.slug);
    assert.ok(recipe, \`missing recipe for \${photo.slug}\`);
    assert.equal(recipe.id, photo.id, \`${photo.slug}: recipe id mismatch\`);
    assert.equal(recipe.recipe.title, photo.title, \`${photo.slug}: title mismatch\`);
    assert.equal(recipeHasPhoto(recipe.recipe, recipe.slug), true, \`${photo.slug}: recipeHasPhoto\`);
    for (const ratio of ["1x1", "4x3", "16x9"]) {
      assert.equal(fs.existsSync(\`public/img/\${photo.slug}-\${ratio}.webp\`), true, \`${photo.slug}: missing \${ratio}\`);
    }
  }
});

test("manifest содержит те же 119 рецептов, а рецепты без фото не получают URL", () => {
  const manifest = recipePhotoManifest(2);
  assert.equal(manifest.length, 119);
  assert.deepEqual(new Set(manifest.map((entry) => entry.slug)), new Set(RECIPE_PHOTO_CATALOG.map((entry) => entry.slug)));

  const entries = seoRecipeEntries(2);
  const withoutPhoto = entries.find((entry) => !recipeHasPhoto(entry.recipe, entry.slug));
  assert.ok(withoutPhoto, "expected at least one recipe without an illustration");
  assert.deepEqual(recipeImageUrls(withoutPhoto.recipe, withoutPhoto.slug), []);
});
`);

let packageJson = JSON.parse(read("package.json"));
packageJson.scripts.build = "npm test && vite build && node scripts/check-static-recipe-assets.mjs dist/img";
packageJson.scripts["check:static-assets"] = "node scripts/check-static-recipe-assets.mjs public/img && node scripts/check-static-recipe-assets.mjs dist/img";
write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

let publicTests = read("test/public-app-routes.test.mjs");
publicTests = publicTests.replace(
  'import { recipeImageSet, recipeImageUrls, recipePhotoManifest, serveRecipeImage, serveRecipePhotoManifest } from "../worker/recipe-images.js";',
  'import { recipeImageSet, recipeImageUrls, recipePhotoManifest, serveRecipePhotoManifest } from "../worker/recipe-images.js";\nimport { recipeHasPhoto } from "../worker/recipe-photo-catalog.js";',
);
publicTests = publicTests.replace(
  'for (const file of ["worker/public-app-pages.js", "worker/fresh-sitemap.js", "worker/recipe-images.js", "src/public-routes.js", "public/recipe-photos.js"])',
  'for (const file of ["worker/public-app-pages.js", "worker/fresh-sitemap.js", "worker/recipe-images.js", "worker/recipe-photo-catalog.js", "src/public-routes.js", "public/recipe-photos.js"])',
);

const oldNoPhoto = `test("рецепт без hasPhoto не получает image или og:image", async () => {
  const entry = seoRecipeEntries(2).find((item) => item.hasPhoto !== true) || seoRecipeEntries(2)[0];
  const response = await servePublicAppPage(new Request(\`https://kutno.ru\${entry.pathname}\`), env);
  const html = await response.text();
  assert.doesNotMatch(html, /"image":\\[/);
  assert.doesNotMatch(html, /property="og:image"/);
  assert.doesNotMatch(html, /name="twitter:image"/);
  assert.match(html, /name="twitter:card" content="summary"/);
});`;
const newNoPhoto = `test("рецепт без записи в фотокаталоге не получает image или og:image", async () => {
  const entry = seoRecipeEntries(2).find((item) => !recipeHasPhoto(item.recipe, item.slug));
  assert.ok(entry);
  const response = await servePublicAppPage(new Request(\`https://kutno.ru\${entry.pathname}\`), env);
  const html = await response.text();
  assert.doesNotMatch(html, /"image":\\[/);
  assert.doesNotMatch(html, /property="og:image"/);
  assert.doesNotMatch(html, /name="twitter:image"/);
  assert.match(html, /name="twitter:card" content="summary"/);
});`;
if (!publicTests.includes(oldNoPhoto)) throw new Error("public-app-routes: no-photo test not found");
publicTests = publicTests.replace(oldNoPhoto, newNoPhoto);

const oldUrls = `test("фото URL выводятся только при явном hasPhoto", () => {
  assert.deepEqual(recipeImageUrls({}, "syrniki"), []);
  assert.deepEqual(recipeImageUrls({ hasPhoto: false }, "syrniki"), []);
  assert.deepEqual(recipeImageUrls({ hasPhoto: true }, "syrniki"), ["https://kutno.ru/img/syrniki-1x1.webp", "https://kutno.ru/img/syrniki-4x3.webp", "https://kutno.ru/img/syrniki-16x9.webp"]);
  assert.equal(recipeImageSet({ hasPhoto: true }, "syrniki").social, "https://kutno.ru/img/syrniki-16x9.webp");
});`;
const newUrls = `test("фото URL строятся только для slug из фотокаталога", () => {
  assert.equal(recipeHasPhoto({}, "syrniki"), true);
  assert.deepEqual(recipeImageUrls({}, "syrniki"), ["https://kutno.ru/img/syrniki-1x1.webp", "https://kutno.ru/img/syrniki-4x3.webp", "https://kutno.ru/img/syrniki-16x9.webp"]);
  assert.equal(recipeImageSet({}, "syrniki").social, "https://kutno.ru/img/syrniki-16x9.webp");
  assert.deepEqual(recipeImageUrls({}, "net-takogo-retsepta"), []);
});`;
if (!publicTests.includes(oldUrls)) throw new Error("public-app-routes: URL test not found");
publicTests = publicTests.replace(oldUrls, newUrls);

const oldManifest = `test("пока картинки не включены, фото-манифест пуст", async () => {
  assert.deepEqual(recipePhotoManifest(2), []);
  const response = serveRecipePhotoManifest(new Request("https://kutno.ru/api/photo-manifest"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { photos: [] });
});`;
const newManifest = `test("фото-манифест возвращает ровно 119 подключённых рецептов", async () => {
  const photos = recipePhotoManifest(2);
  assert.equal(photos.length, 119);
  assert.equal(new Set(photos.map((item) => item.slug)).size, 119);
  const response = serveRecipePhotoManifest(new Request("https://kutno.ru/api/photo-manifest"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { photos });
});`;
if (!publicTests.includes(oldManifest)) throw new Error("public-app-routes: manifest test not found");
publicTests = publicTests.replace(oldManifest, newManifest);

const oldR2 = `test("/img безопасно отдаёт 404 до подключения R2", async () => {
  const response = await serveRecipeImage(new Request("https://kutno.ru/img/syrniki-4x3.webp"), {});
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
});`;
const newR2 = `test("/img полностью исключён из Worker/R2 и остаётся Static Assets маршрутом", () => {
  const routes = readFileSync("worker/routes.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.doesNotMatch(routes, /serveRecipeImage|recipe-image|prefix\\("\\/img\\//);
  assert.doesNotMatch(wrangler, /"\\/img\\/\\*"/);
  assert.doesNotMatch(wrangler, /r2_buckets|\\bIMAGES\\b/);
  assert.match(wrangler, /"directory"\\s*:\\s*"\\.\\/dist"/);
  assert.match(wrangler, /"binding"\\s*:\\s*"ASSETS"/);
});`;
if (!publicTests.includes(oldR2)) throw new Error("public-app-routes: R2 test not found");
publicTests = publicTests.replace(oldR2, newR2);

publicTests = publicTests.replace(
  '  assert.match(wrangler, /"\\\\/img\\\\/\\\\*"/);\n',
  '  assert.doesNotMatch(wrangler, /"\\\\/img\\\\/\\\\*"/);\n',
);

const insertBefore = `test("рецепт без записи в фотокаталоге не получает image или og:image", async () => {`;
const photoSeoTest = `test("рецепт с иллюстрацией получает 16:9 OG/Twitter и три URL в Recipe JSON-LD", async () => {
  const entry = seoRecipeEntries(2).find((item) => item.slug === "syrniki");
  assert.ok(entry);
  const response = await servePublicAppPage(new Request(\`https://kutno.ru\${entry.pathname}\`), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /property="og:image" content="https:\\/\\/kutno\\.ru\\/img\\/syrniki-16x9\\.webp"/);
  assert.match(html, /name="twitter:image" content="https:\\/\\/kutno\\.ru\\/img\\/syrniki-16x9\\.webp"/);
  assert.match(html, /"image":\\["https:\\/\\/kutno\\.ru\\/img\\/syrniki-1x1\\.webp","https:\\/\\/kutno\\.ru\\/img\\/syrniki-4x3\\.webp","https:\\/\\/kutno\\.ru\\/img\\/syrniki-16x9\\.webp"\\]/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

`;
if (!publicTests.includes(insertBefore)) throw new Error("public-app-routes: insert point missing");
publicTests = publicTests.replace(insertBefore, photoSeoTest + insertBefore);
write("test/public-app-routes.test.mjs", publicTests);

let routeTests = read("test/route-table.test.mjs");
routeTests = routeTests.replace(
  '    ["GET", "/anything", "assets"],\n',
  '    ["GET", "/anything", "assets"],\n    ["GET", "/img/syrniki-4x3.webp", "assets"],\n',
);
write("test/route-table.test.mjs", routeTests);

let checkWorkflow = read(".github/workflows/check.yml");
const buildStep = `      - name: Build
        run: npx vite build
`;
if (!checkWorkflow.includes(buildStep)) throw new Error("check workflow build step not found");
const staticSteps = `      - name: Build
        run: npx vite build
      - name: Verify recipe static assets
        run: node scripts/check-static-recipe-assets.mjs dist/img
      - name: QA recipe static asset HTTP
        shell: bash
        run: |
          set -euo pipefail
          npx wrangler dev --local --port 8799 > /tmp/wrangler-static.log 2>&1 &
          pid=$!
          cleanup() { kill "$pid" 2>/dev/null || true; }
          trap cleanup EXIT
          ready=0
          for attempt in $(seq 1 30); do
            code=$(curl --silent --output /tmp/syrniki.webp --dump-header /tmp/syrniki.headers --write-out '%{http_code}' http://127.0.0.1:8799/img/syrniki-4x3.webp || true)
            if [ "$code" = "200" ]; then ready=1; break; fi
            sleep 1
          done
          if [ "$ready" != "1" ]; then
            cat /tmp/wrangler-static.log
            exit 1
          fi
          grep -qi '^content-type: image/webp' /tmp/syrniki.headers
          missing=$(curl --silent --output /tmp/missing.webp --write-out '%{http_code}' http://127.0.0.1:8799/img/definitely-not-a-recipe.webp)
          test "$missing" = "404"
`;
checkWorkflow = checkWorkflow.replace(buildStep, staticSteps);
write(".github/workflows/check.yml", checkWorkflow);

console.log(`Prepared ${photoEntries.length} recipe photos on Static Assets`);
