import { mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const outdir = new URL("../.worker-build/", import.meta.url);
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const result = await build({
  entryPoints: [new URL("../worker/next-entry.js", import.meta.url).pathname],
  outfile: new URL("index.js", outdir).pathname,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  charset: "utf8",
  minify: true,
  legalComments: "none",
  treeShaking: true,
  sourcemap: false,
  metafile: true,
  external: ["node:*", "cloudflare:*"],
});

await writeFile(new URL("meta.json", outdir), JSON.stringify(result.metafile));
console.log("Worker prebundle built with UTF-8 output.");
