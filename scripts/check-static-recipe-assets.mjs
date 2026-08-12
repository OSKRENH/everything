import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED = {
  "1x1": [1200, 1200],
  "4x3": [1200, 900],
  "16x9": [1200, 675],
};
// Tiny placeholder/corrupt assets must never reach production.
const MIN_IMAGE_BYTES = 10_000;

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
    assert.ok(end <= buffer.length, `truncated ${fourcc} chunk`);

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
  assert.equal(entries.length, 681, `${directory}: expected 681 files`);
  assert.ok(entries.every((entry) => entry.isFile()), `${directory}: nested folders are not allowed`);

  const bySlug = new Map();
  for (const entry of entries) {
    const match = entry.name.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)-(1x1|4x3|16x9)\.webp$/);
    assert.ok(match, `${directory}: invalid filename ${entry.name}`);
    const [, slug, ratio] = match;
    const file = path.join(absolute, entry.name);
    const stat = fs.statSync(file);
    assert.ok(stat.size >= MIN_IMAGE_BYTES, `${entry.name}: suspiciously small image (${stat.size} bytes)`);
    const dimensions = webpDimensions(fs.readFileSync(file));
    assert.deepEqual(dimensions, EXPECTED[ratio], `${entry.name}: wrong dimensions`);
    if (!bySlug.has(slug)) bySlug.set(slug, new Set());
    bySlug.get(slug).add(ratio);
  }

  assert.equal(bySlug.size, 227, `${directory}: expected 227 slugs`);
  for (const [slug, ratios] of bySlug) {
    assert.deepEqual([...ratios].sort(), ["16x9", "1x1", "4x3"].sort(), `${slug}: incomplete image set`);
  }
  return bySlug;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const directory = process.argv[2] || "public/img";
  const slugs = checkImageDirectory(directory);
  console.log(`Verified ${slugs.size} recipe image sets / 681 WebP files in ${directory}`);
}
