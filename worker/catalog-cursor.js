import { CATALOG_VERSION } from "./recipe-catalog.js";

const CURSOR_PREFIX = `kutno:${CATALOG_VERSION}:`;

function base64UrlEncode(value) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

export function encodeCatalogCursor(offset) {
  return base64UrlEncode(`${CURSOR_PREFIX}${Math.max(0, Math.floor(Number(offset) || 0))}`);
}

export function decodeCatalogCursor(cursor = "") {
  if (!cursor) return 0;
  try {
    const decoded = base64UrlDecode(cursor);
    if (!decoded.startsWith(CURSOR_PREFIX)) return 0;
    const offset = Number(decoded.slice(CURSOR_PREFIX.length));
    return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}
