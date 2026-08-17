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

function parsePurchasedAmount(value = "") {
  const text = String(value).trim().toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  if (!text) return null;
  const match = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(кг|г|мл|л|шт\.?|уп\.?|упаковк(?:а|и|ок)?|банк(?:а|и|ок)?)(?:\s|$)/u);
  if (!match) return null;
  const quantity = Number(match[1].replace(",", "."));
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  let unit = match[2];
  if (/^шт/.test(unit)) unit = "шт.";
  else if (/^уп/.test(unit)) unit = "уп.";
  else if (/^банк/.test(unit)) unit = "банка";
  return { quantity, unit };
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

function rememberBoughtAmounts() {
  const bought = readShopping().filter((item) => item?.checked && item?.name);
  if (!bought.length) return;

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
  // Capture the quantities before kutno-features removes checked shopping rows.
  rememberBoughtAmounts();
}

document.addEventListener("click", handleMoveBought, true);

export { mergePurchasedAmount, parsePurchasedAmount };
