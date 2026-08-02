(() => {
  const KITCHEN_KEY = "kutno-kitchen-v2";
  const COOKING_HISTORY_KEY = "kutno-cooking-history-v1";
  const SWIPE_HISTORY_KEY = "kutno-swipe-history-v1";
  const AUTH_PATHS = new Set([
    "/api/auth/me",
    "/api/auth/google",
    "/api/auth/login",
    "/api/auth/register",
  ]);
  const ILLUSTRATIONS = [
    "/illustrations/kitchen-hero.webp",
    "/illustrations/base-hero.webp",
    "/illustrations/am-heart-hero.webp",
    "/illustrations/favorites-hero.webp",
    "/illustrations/pot-loader.gif",
  ];
  const originalFetch = window.fetch.bind(window);

  let settingsOpen = window.matchMedia("(min-width: 701px)").matches;
  let emailAuthExpanded = false;
  let enhancing = false;
  let syntheticViewClick = false;

  window.__kutnoIllustrationCache = ILLUSTRATIONS.map((src) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    image.decode?.().catch(() => {});
    return image;
  });

  function readJson(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function uniqueStrings(...lists) {
    const result = [];
    const seen = new Set();
    for (const value of lists.flat()) {
      const text = String(value || "").trim();
      const key = text.toLocaleLowerCase("ru-RU");
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
    return result;
  }

  function mergeHistory(remote = [], local = [], dateKey = "at") {
    const byId = new Map();
    for (const item of [...remote, ...local]) {
      if (!item || typeof item !== "object" || !item.id) continue;
      const previous = byId.get(item.id);
      if (!previous || Number(item[dateKey] || 0) >= Number(previous[dateKey] || 0)) {
        byId.set(item.id, item);
      }
    }
    return [...byId.values()].sort((a, b) => Number(b[dateKey] || 0) - Number(a[dateKey] || 0));
  }

  function mergeKitchen(remoteKitchen) {
    const remote = remoteKitchen && typeof remoteKitchen === "object" ? remoteKitchen : {};
    const local = readJson(KITCHEN_KEY);
    const localCookingHistory = readJson(COOKING_HISTORY_KEY, []);
    const localSwipeHistory = readJson(SWIPE_HISTORY_KEY, []);
    const hasLocalKitchen = Array.isArray(local.ingredients) && local.ingredients.length > 0;
    const hasLocalHistory = localCookingHistory.length > 0 || localSwipeHistory.length > 0;

    if (!hasLocalKitchen && !hasLocalHistory) return remote;

    const ingredients = uniqueStrings(remote.ingredients || [], local.ingredients || []);
    const priorityIngredients = uniqueStrings(
      local.priorityIngredients || [],
      remote.priorityIngredients || [],
    ).filter((item) => ingredients.some((ingredient) => ingredient.toLocaleLowerCase("ru-RU") === item.toLocaleLowerCase("ru-RU"))).slice(0, 3);

    return {
      ...remote,
      ...(hasLocalKitchen ? local : {}),
      ingredients,
      priorityIngredients,
      equipment: uniqueStrings(remote.equipment || [], local.equipment || []),
      cookingHistory: mergeHistory(remote.cookingHistory, localCookingHistory, "cookedAt").slice(0, 200),
      swipeHistory: mergeHistory(remote.swipeHistory, localSwipeHistory, "at").slice(0, 500),
    };
  }

  function responseWithJson(response, data) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    let pathname = "";
    try {
      pathname = new URL(typeof input === "string" ? input : input.url, location.href).pathname;
    } catch {
      return response;
    }

    if (!response.ok || !AUTH_PATHS.has(pathname)) return response;

    try {
      const data = await response.clone().json();
      if (!data?.user || !data?.kitchen) return response;
      const mergedKitchen = mergeKitchen(data.kitchen);
      const changed = JSON.stringify(mergedKitchen) !== JSON.stringify(data.kitchen);
      data.kitchen = mergedKitchen;

      if (changed) {
        localStorage.setItem(KITCHEN_KEY, JSON.stringify(mergedKitchen));
        queueMicrotask(() => {
          originalFetch("/api/kitchen", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(mergedKitchen),
          }).catch(() => {});
        });
      }

      return responseWithJson(response, data);
    } catch {
      return response;
    }
  };

  function portionsLabel(value) {
    const number = Math.max(1, Number(value) || 2);
    const mod10 = number % 10;
    const mod100 = number % 100;
    const word = mod10 === 1 && mod100 !== 11 ? "порция" : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? "порции" : "порций";
    return `${number} ${word}`;
  }

  function settingsDescription() {
    const state = readJson(KITCHEN_KEY);
    const mode = state.searchMode === "plus-one" ? "можно докупить 1" : "без покупок";
    const time = Number(state.maxMinutes) ? `до ${Number(state.maxMinutes)} мин` : "любое время";
    return `${mode} · ${time} · ${portionsLabel(state.portions)}`;
  }

  function enhanceImages() {
    document.querySelectorAll(".section-illustration img, .pot-loader").forEach((image) => {
      image.loading = "eager";
      image.decoding = "async";
    });
  }

  function enhanceSettings() {
    const form = document.querySelector(".kitchen-form");
    if (!form) return;
    const existing = form.querySelector(":scope > .advanced-settings");
    if (existing) {
      const description = existing.querySelector("summary small");
      if (description) description.textContent = settingsDescription();
      return;
    }

    const sections = [...form.querySelectorAll(":scope > .form-section")].filter((section) => !section.classList.contains("ingredient-section"));
    const primary = form.querySelector(":scope > .primary-action");
    if (!sections.length || !primary) return;

    const details = document.createElement("details");
    details.className = "advanced-settings";
    details.open = settingsOpen;
    details.innerHTML = `
      <summary>
        <span>Настройки</span>
        <small>${settingsDescription()}</small>
        <i aria-hidden="true"></i>
      </summary>
      <div class="advanced-settings-body"></div>
    `;
    const body = details.querySelector(".advanced-settings-body");
    sections.forEach((section) => body.append(section));
    form.insertBefore(details, primary);
    details.addEventListener("toggle", () => {
      settingsOpen = details.open;
    });
  }

  function enhanceAuth() {
    const card = document.querySelector(".auth-card:not(.account-card):not(.confirm-card)");
    if (!card || card.dataset.compactAuth === "true") return;
    const oauth = card.querySelector(".oauth-options");
    const form = card.querySelector("#auth-form");
    if (!oauth || !form) return;

    card.dataset.compactAuth = "true";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "auth-email-toggle";
    toggle.textContent = emailAuthExpanded ? "Скрыть вход по почте" : "Войти по почте";
    oauth.insertAdjacentElement("afterend", toggle);

    const note = card.querySelector(".google-auth-note");
    if (note) note.textContent = "Кутно получает только имя и почту. Пароли остаются у сервиса.";

    const paint = () => {
      card.classList.toggle("email-auth-collapsed", !emailAuthExpanded);
      toggle.textContent = emailAuthExpanded ? "Скрыть вход по почте" : "Войти по почте";
    };
    toggle.addEventListener("click", () => {
      emailAuthExpanded = !emailAuthExpanded;
      paint();
      if (emailAuthExpanded) requestAnimationFrame(() => form.querySelector("input")?.focus());
    });
    paint();
  }

  function enhance() {
    if (enhancing) return;
    enhancing = true;
    try {
      enhanceSettings();
      enhanceAuth();
      enhanceImages();
    } finally {
      enhancing = false;
    }
  }

  function runViewClick(target) {
    syntheticViewClick = true;
    target.click();
    return Promise.resolve().then(() => enhance());
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-view]");
    if (!target || syntheticViewClick || target.classList.contains("active")) return;
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition === "function" && !reducedMotion) {
      const transition = document.startViewTransition(() => runViewClick(target));
      transition.finished.finally(() => {
        syntheticViewClick = false;
      });
      return;
    }

    const root = document.documentElement;
    root.classList.add("kutno-view-leaving");
    window.setTimeout(() => {
      runViewClick(target).finally(() => {
        root.classList.remove("kutno-view-leaving");
        root.classList.add("kutno-view-entering");
        requestAnimationFrame(() => requestAnimationFrame(() => {
          root.classList.remove("kutno-view-entering");
          syntheticViewClick = false;
        }));
      });
    }, reducedMotion ? 0 : 110);
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-auth-mode]")) emailAuthExpanded = true;
    if (event.target.closest("[data-action='account']")) emailAuthExpanded = false;
    if (event.target.closest("[data-search-mode], [data-max-minutes], [data-portions], [data-kitchen-course], [data-difficulty]")) {
      queueMicrotask(enhance);
    }
  }, true);

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhance();
  document.addEventListener("DOMContentLoaded", enhance, { once: true });
})();