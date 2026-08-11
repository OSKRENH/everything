#!/usr/bin/env node

const BASE = "https://kutno.ru";
const INGREDIENTS = ["яйца", "картошка", "лук"];
const KEYS = Array.from({ length: 12 }, (_, index) => `kutno-affinity-${index + 1}`);

async function generate(versionKey) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache",
      "Cloudflare-Workers-Version-Key": versionKey,
    },
    body: JSON.stringify({ ingredients: INGREDIENTS }),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  const title = text.match(/<title>([^<]+)/i)?.[1] || "";
  return {
    status: res.status,
    count: Array.isArray(json.recipes) ? json.recipes.length : -1,
    timing: res.headers.get("server-timing") || "",
    ray: res.headers.get("cf-ray") || "",
    title,
    ids: Array.isArray(json.recipes) ? json.recipes.map((recipe) => recipe.id).join("|") : "",
  };
}

let mixedKeys = 0;
let successKeys = 0;
let failureKeys = 0;

for (const key of KEYS) {
  const outcomes = new Set();
  const variants = new Set();
  console.log(`\n=== key=${key} ===`);
  for (let run = 1; run <= 6; run++) {
    const result = await generate(key);
    outcomes.add(result.status);
    if (result.status === 200) variants.add(result.ids);
    console.log(`#${run} status=${result.status} count=${result.count} timing=${result.timing || "-"} ray=${result.ray || "-"} title=${result.title || "-"}`);
  }
  if (outcomes.size > 1) mixedKeys++;
  else if (outcomes.has(200)) successKeys++;
  else failureKeys++;
  console.log(`outcomes=${[...outcomes].join(",")} variants=${variants.size}`);
}

console.log(`\nSUMMARY successKeys=${successKeys} failureKeys=${failureKeys} mixedKeys=${mixedKeys}`);
if (!successKeys || !failureKeys || mixedKeys) {
  console.log("Affinity result does not cleanly prove a two-version split.");
} else {
  console.log("Affinity result is consistent with an active split deployment: stable keys map to different outcomes.");
}
