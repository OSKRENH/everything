import { kutnoApi } from "./kutno-api.js";

const PANTRY_KEY = "kutno-pantry-details-v1";
const FEEDBACK_KEY = "kutno-recipe-feedback-v1";
const feedbackWindow = 1000 * 60 * 60 * 24 * 45;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeIngredientName(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9\s-]/gi, " ").replace(/\s+/g, " ").trim();
}

function cleanNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sanitizePantry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 120).flatMap(([key, item]) => {
    const name = String(item?.name || key || "").trim().slice(0, 120);
    const normalized = normalizeIngredientName(name);
    if (!normalized) return [];
    const useBy = String(item?.useBy || "");
    return [[normalized, {
      name,
      quantity: cleanNumber(item?.quantity),
      unit: ["", "г", "кг", "мл", "л", "шт.", "уп.", "банка"].includes(item?.unit) ? item.unit : "",
      useBy: /^\d{4}-\d{2}-\d{2}$/.test(useBy) ? useBy : "",
      opened: Boolean(item?.opened),
      updatedAt: Math.max(0, Number(item?.updatedAt) || Date.now()),
    }]];
  }));
}

function sanitizeFeedback(value) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 300).flatMap((item) => {
    const recipeId = String(item?.recipeId || "").slice(0, 100);
    const reason = ["dislike-ingredient", "too-long", "too-hard", "not-today", "more-like-this"].includes(item?.reason) ? item.reason : "";
    if (!recipeId || !reason) return [];
    return [{
      recipeId,
      title: String(item?.title || "").slice(0, 180),
      reason,
      ingredient: String(item?.ingredient || "").slice(0, 120),
      minutes: Math.max(0, Number(item?.minutes) || 0),
      difficulty: String(item?.difficulty || "").slice(0, 40),
      at: Math.max(0, Number(item?.at) || Date.now()),
      updatedAt: Math.max(0, Number(item?.updatedAt) || Date.now()),
    }];
  });
}

function mergeObjectsByUpdatedAt(local, remote) {
  const result = { ...remote };
  Object.entries(local).forEach(([key, item]) => {
    if (!result[key] || Number(item.updatedAt) >= Number(result[key].updatedAt)) result[key] = item;
  });
  return result;
}

function mergeFeedback(local, remote) {
  const items = new Map();
  [...remote, ...local].forEach((item) => {
    const key = `${item.recipeId}:${item.reason}:${normalizeIngredientName(item.ingredient)}`;
    const previous = items.get(key);
    if (!previous || Number(item.updatedAt) >= Number(previous.updatedAt)) items.set(key, item);
  });
  return [...items.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 300);
}

function unitFactor(unit) {
  return { кг: 1000, г: 1, л: 1000, мл: 1, "шт.": 1, шт: 1 }[normalizeIngredientName(unit).replace(" ", "")] || 1;
}

export function parseAmount(value = "") {
  const text = String(value).toLowerCase().replace(",", ".");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(кг|г|мл|л|шт\.?)/u);
  if (!match) return null;
  const unit = match[2].replace(/^шт$/, "шт.");
  return { value: Number(match[1]) * unitFactor(unit), family: /кг|г/.test(unit) ? "mass" : /мл|л/.test(unit) ? "volume" : "count" };
}

function pantryComparable(item) {
  if (!item || item.quantity == null || !item.unit) return null;
  const unit = item.unit;
  return {
    value: item.quantity * unitFactor(unit),
    family: /кг|г/.test(unit) ? "mass" : /мл|л/.test(unit) ? "volume" : /шт/.test(unit) ? "count" : "other",
  };
}

function recipeIngredientMatches(recipeIngredient, pantryName) {
  const target = normalizeIngredientName(pantryName);
  const candidates = [recipeIngredient?.name, ...(Array.isArray(recipeIngredient?.aliases) ? recipeIngredient.aliases : [])].map(normalizeIngredientName).filter(Boolean);
  return candidates.some((candidate) => candidate === target || candidate.includes(target) || target.includes(candidate));
}

function daysUntil(dateString) {
  if (!dateString) return Infinity;
  const target = new Date(`${dateString}T23:59:59`);
  if (Number.isNaN(target.getTime())) return Infinity;
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

class KutnoStore extends EventTarget {
  constructor() {
    super();
    this.pantry = sanitizePantry(readJson(PANTRY_KEY, {}));
    this.feedback = sanitizeFeedback(readJson(FEEDBACK_KEY, []));
    this.syncTimer = 0;
    this.remoteLoadedFor = "";
  }

  snapshot() {
    return { pantry: structuredClone(this.pantry), feedback: structuredClone(this.feedback) };
  }

  setPantry(items) {
    this.pantry = sanitizePantry(items);
    writeJson(PANTRY_KEY, this.pantry);
    this.changed("pantry");
  }

  updatePantry(name, patch) {
    const normalized = normalizeIngredientName(name);
    if (!normalized) return;
    this.pantry[normalized] = {
      name: String(name).trim(),
      quantity: cleanNumber(patch.quantity),
      unit: patch.unit || "",
      useBy: patch.useBy || "",
      opened: Boolean(patch.opened),
      updatedAt: Date.now(),
    };
    writeJson(PANTRY_KEY, this.pantry);
    this.changed("pantry");
  }

  removeMissingIngredients(currentIngredients) {
    const allowed = new Set(currentIngredients.map(normalizeIngredientName));
    const next = Object.fromEntries(Object.entries(this.pantry).filter(([key]) => allowed.has(key)));
    if (Object.keys(next).length !== Object.keys(this.pantry).length) this.setPantry(next);
  }

  addFeedback(entry) {
    const item = sanitizeFeedback([{ ...entry, at: Date.now(), updatedAt: Date.now() }])[0];
    if (!item) return;
    this.feedback = mergeFeedback([item], this.feedback);
    writeJson(FEEDBACK_KEY, this.feedback);
    this.changed("feedback");
  }

  changed(type) {
    this.dispatchEvent(new CustomEvent("change", { detail: { type } }));
    this.scheduleSync();
  }

  scheduleSync() {
    window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => this.syncRemote(), 600);
  }

  async loadRemote(userId = "") {
    if (!userId || this.remoteLoadedFor === String(userId)) return;
    this.remoteLoadedFor = String(userId);
    try {
      const data = await kutnoApi.getFeatureState();
      const remotePantry = sanitizePantry(data.state?.pantry || {});
      const remoteFeedback = sanitizeFeedback(data.state?.feedback || []);
      this.pantry = mergeObjectsByUpdatedAt(this.pantry, remotePantry);
      this.feedback = mergeFeedback(this.feedback, remoteFeedback);
      writeJson(PANTRY_KEY, this.pantry);
      writeJson(FEEDBACK_KEY, this.feedback);
      this.dispatchEvent(new CustomEvent("change", { detail: { type: "remote" } }));
      await this.syncRemote();
    } catch {
      this.remoteLoadedFor = "";
    }
  }

  async syncRemote() {
    try {
      await kutnoApi.putFeatureState({ pantry: this.pantry, feedback: this.feedback, updatedAt: Date.now() });
    } catch {
      // Локальные данные остаются основной копией до следующей попытки.
    }
  }

  urgentIngredients(maxDays = 2) {
    return Object.values(this.pantry)
      .map((item) => ({ ...item, days: daysUntil(item.useBy) }))
      .filter((item) => item.days <= maxDays)
      .sort((a, b) => a.days - b.days || Number(b.opened) - Number(a.opened));
  }

  expiryBoost(recipe) {
    return this.urgentIngredients(3).reduce((score, item) => {
      const used = (recipe?.ingredients || []).some((ingredient) => recipeIngredientMatches(ingredient, item.name));
      if (!used) return score;
      return score + (item.days <= 0 ? 70 : item.days === 1 ? 50 : 30) + (item.opened ? 10 : 0);
    }, 0);
  }

  preferencePenalty(recipe) {
    const now = Date.now();
    const relevant = this.feedback.filter((item) => now - item.at <= feedbackWindow);
    let penalty = 0;
    for (const item of relevant) {
      if (item.reason === "dislike-ingredient" && item.ingredient && (recipe?.ingredients || []).some((ingredient) => recipeIngredientMatches(ingredient, item.ingredient))) penalty += 120;
      if (item.reason === "too-long" && Number(recipe?.minutes) >= Math.max(20, item.minutes || 30)) penalty += 30;
      if (item.reason === "too-hard" && /слож|обыч/.test(String(recipe?.difficulty || "").toLowerCase())) penalty += 25;
      if (item.reason === "not-today" && item.title && normalizeIngredientName(recipe?.title) === normalizeIngredientName(item.title) && now - item.at < 7 * 86_400_000) penalty += 80;
      if (item.reason === "more-like-this" && item.title && normalizeIngredientName(recipe?.title) === normalizeIngredientName(item.title)) penalty -= 50;
    }
    return penalty;
  }

  quantityAssessment(recipe) {
    const low = [];
    const enough = [];
    for (const pantryItem of Object.values(this.pantry)) {
      const ingredient = (recipe?.ingredients || []).find((candidate) => recipeIngredientMatches(candidate, pantryItem.name));
      if (!ingredient) continue;
      const need = parseAmount(ingredient.amount);
      const have = pantryComparable(pantryItem);
      if (!need || !have || need.family !== have.family) continue;
      if (have.value + 0.001 < need.value) low.push({ name: pantryItem.name, have: pantryItem, need: ingredient.amount });
      else enough.push({ name: pantryItem.name, have: pantryItem, need: ingredient.amount });
    }
    return { low, enough };
  }
}

export const kutnoStore = new KutnoStore();
