import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".worker-dry");
const maxBytes = Number(process.env.KUTNO_WORKER_MAX_BYTES || 300 * 1024);
const maxEscapedCyrillic = Number(process.env.KUTNO_WORKER_MAX_ESCAPED_CYRILLIC || 8);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

if (!fs.existsSync(root)) throw new Error(`Worker dry-run directory is missing: ${root}`);
const jsFiles = walk(root).filter((file) => /\.(?:m?js)$/i.test(file));
if (!jsFiles.length) throw new Error(`No Worker JavaScript emitted under ${root}`);

const measured = jsFiles.map((file) => {
  const source = fs.readFileSync(file, "utf8");
  return {
    file,
    bytes: Buffer.byteLength(source),
    escapedCyrillic: (source.match(/\\u04[0-9a-f]{2}/gi) || []).length,
  };
}).sort((a, b) => b.bytes - a.bytes);

const entry = measured[0];
console.log(`Worker entry: ${path.relative(process.cwd(), entry.file)}`);
console.log(`Worker bytes: ${entry.bytes}`);
console.log(`Escaped Cyrillic sequences: ${entry.escapedCyrillic}`);
console.log(`Worker budget: ${maxBytes} bytes; escaped Cyrillic budget: ${maxEscapedCyrillic}`);

const metaPath = path.resolve(".worker-build/meta.json");
if (fs.existsSync(metaPath)) {
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const output = Object.values(meta.outputs || {}).find((item) => item.entryPoint) || Object.values(meta.outputs || {})[0];
  const top = Object.entries(output?.inputs || {})
    .map(([file, info]) => ({ file, bytes: Number(info.bytesInOutput) || 0 }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12);
  console.log("Top Worker inputs:");
  for (const item of top) console.log(`${String(item.bytes).padStart(8)}  ${item.file}`);
}

if (entry.bytes > maxBytes) throw new Error(`Worker bundle ${entry.bytes} bytes exceeds ${maxBytes}-byte budget`);
if (entry.escapedCyrillic > maxEscapedCyrillic) throw new Error(`Worker bundle contains ${entry.escapedCyrillic} escaped Cyrillic sequences`);
