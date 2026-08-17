import { kutnoStore, normalizeIngredientName } from "./kutno-store.js";

const SHOPPING_KEY = "kutno-shopping-v2";

function readShopping() {
  try {
    const value = JSON.parse(localStorage.getItem(SHOPPING_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalizeUnit(value = "") {
  const unit = String(value).toLocaleLowerCase("ru-RU");
  if (/^шт/.test(unit)) return "шт.";
  if (/^уп/.test(unit)) return "уп.";
  if (/^банк/.test(unit)) return "банка";
  return unit;
}

function unitFamily(unit) {
  if (["г", "кг"].includes(unit)) return "mass";
  if (["мл", "л"].includes(unit)) return "volume";
  if (unit === "шт.") return "count";
  if (unit === "уп.") return "package";
  if (unit === "банка") return "jar";
  return "";
}

function toBase(quantity, unit) {
  if (unit === "кг" || unit === "л") return quantity * 1000;
  return quantity;
}

function fromBase(quantity, unit) {
  if (unit === "кг" || unit === "л") return quantity / 1000;
  return quantity;
}

function parsePurchasedAmount(value = "") {
  const text = String(value).trim().toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  if (!text) return null;
  const matches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(кг|г|мл|л|шт\.?|уп\.?|упаковк(?:а|и|ок)?|банк(?:а|и|ок)?)/gu)];
  if (!matches.length) return null;
  const parsed = matches.map((match) => ({
    quantity: Number(match[1].replace(",", ".")),
    unit: normalizeUnit(match[2]),
  })).filter((item) => Number.isFinite(item.quantity) && item.quantity >= 0 && unitFamily(item.unit));
  if (!parsed.length) return null;
  const family = unitFamily(parsed[0].unit);
  const compatible = parsed.filter((item) => unitFamily(item.unit) === family);
  const unit = compatible[0].unit;
  const quantity = compatible.reduce((sum, item) => sum + toBase(item.quantity, item.unit), 0);
  return {
    quantity: Math.round(fromBase(quantity, unit) * 100) / 100,
    unit,
  };
}

function mergePurchasedAmount(existing, purchased) {
  if (!purchased) return existing || null;
  if (!existing || existing.quantity == null || !existing.unit) return purchased;
  const existingFamily = unitFamily(existing.unit);
  const purchasedFamily = unitFamily(purchased.unit);
  if (!existingFamily || existingFamily !== purchasedFamily) return purchased;
  const combinedBase = toBase(Number(existing.quantity) || 0, existing.unit) + toBase(purchased.quantity, purchased.unit);
  return {
    quantity: Math.round(fromBase(combinedBase, existing.unit) * 100) / 100,
    unit: existing.unit,
  };
}

function applyBoughtAmounts(bought) {
  for (const item of bought) {
    const parsed = parsePurchasedAmount(item.amount);
    if (!parsed) continue;
    const key = normalizeIngredientName(item.name);
    const existing = kutnoStore.pantry[key];
    const merged = mergePurchasedAmount(existing, parsed);
    if (!merged) continue;
    kutnoStore.updatePantry(item.name, {
      quantity: merged.quantity,
      unit: merged.unit,
      useBy: existing?.useBy || "",
      opened: existing?.opened || false,
    });
  }
}

function handleMoveBought(event) {
  const button = event.target.closest?.('[data-kf-action="move-bought"]');
  if (!button) return;
  // Snapshot before kutno-features removes checked rows, then update pantry
  // after its bubble handler has added the product names to the kitchen.
  const bought = readShopping().filter((item) => item?.checked && item?.name);
  if (!bought.length) return;
  queueMicrotask(() => applyBoughtAmounts(bought));
}

document.addEventListener("click", handleMoveBought, true);

export { mergePurchasedAmount, parsePurchasedAmount };
