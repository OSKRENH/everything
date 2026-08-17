// Static (not dynamic) import: Vite/Rollup bundles this straight into this entry chunk instead of
// splitting it into its own lazily-fetched file, so it costs zero extra requests - it used to be
// a separate <script src="/mobile-recipe-ux.js"> tag awaited before "kutno:ready" could fire,
// which was both an extra network round trip on the critical path and (that file being outside
// Vite's hashed-asset pipeline) served with cache-control: max-age=0, must-revalidate, forcing a
// revalidation trip on every single page load rather than every deploy. Running its module body
// this early (before main.js/public-routes.js have even started loading) is safe: it only sets up
// a MutationObserver plus "kutno:ready"/"kutno:bridge-ready" listeners and calls enhance(document)
// once immediately, none of which touch window.kutnoBridge synchronously - the one place that does
// (the click handler) uses optional chaining and falls back to a plain navigation if kutnoBridge
// isn't ready yet.
import "./mobile-recipe-ux.js";

function setShellStatus(message, failed = false) {
  const shell = document.querySelector("[data-kutno-shell]");
  const status = document.querySelector("[data-kutno-shell-status]");
  if (!shell || !status) return;
  status.textContent = message;
  shell.classList.toggle("is-delayed", failed);
}

function loadPublicModule(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = src;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.append(script);
  });
}

function installFeatureSyncThrottle() {
  const originalFetch = window.fetch.bind(window);
  const interval = 4000;
  let lastSentAt = 0;
  let timer = 0;
  let pending = null;

  function requestDetails(input, init = {}) {
    let method = String(init.method || "GET").toUpperCase();
    let pathname = "";
    try {
      if (typeof Request !== "undefined" && input instanceof Request) {
        method = String(init.method || input.method || "GET").toUpperCase();
        pathname = new URL(input.url, location.origin).pathname;
      } else {
        const raw = typeof input === "string"
          ? input
          : typeof URL !== "undefined" && input instanceof URL
            ? input.href
            : String(input?.url || "");
        pathname = raw ? new URL(raw, location.origin).pathname : "";
      }
    } catch {
      pathname = "";
    }
    return { pathname, method };
  }

  function sendPending() {
    window.clearTimeout(timer);
    timer = 0;
    if (!pending) return;
    const next = pending;
    pending = null;
    lastSentAt = Date.now();
    originalFetch(next.input, { ...next.init, keepalive: true }).catch(() => {});
  }

  window.fetch = function throttledFetch(input, init = {}) {
    const { pathname, method } = requestDetails(input, init);
    if (pathname !== "/api/feature-state" || method !== "PUT") return originalFetch(input, init);
    const elapsed = Date.now() - lastSentAt;
    if (!timer && elapsed >= interval) {
      lastSentAt = Date.now();
      return originalFetch(input, init);
    }
    pending = { input, init };
    if (!timer) timer = window.setTimeout(sendPending, Math.max(100, interval - elapsed));
    return Promise.resolve(new Response(JSON.stringify({ ok: true, queued: true }), {
      status: 202,
      headers: { "content-type": "application/json" },
    }));
  };
  window.addEventListener("pagehide", sendPending);
}

async function startApplication() {
  installFeatureSyncThrottle();
  setShellStatus("Загружаем кухню…");

  try {
    await import("./main.js");
    await import("./public-routes.js");
    document.documentElement.dataset.kutnoReady = "true";
    window.dispatchEvent(new CustomEvent("kutno:ready"));

    const loadExtras = () => Promise.allSettled([
      loadPublicModule("/kutno-features.js?v=5"),
      loadPublicModule("/recipe-photos.js?v=3"),
      import("./kutno-next.js"),
      import("./kutno-ranking.js"),
    ]);
    if ("requestIdleCallback" in window) window.requestIdleCallback(loadExtras, { timeout: 1200 });
    else window.setTimeout(loadExtras, 50);
  } catch (error) {
    console.error("Кутно не запустился", error);
    setShellStatus("Основная версия загружается нестабильно. Откройте лёгкую версию.", true);
    window.dispatchEvent(new CustomEvent("kutno:failed"));
  }
}

const shouldRegisterServiceWorker = "serviceWorker" in navigator
  && location.protocol === "https:"
  && !["localhost", "127.0.0.1"].includes(location.hostname);

if (shouldRegisterServiceWorker) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloadingForFreshWorker = false;
  if (hadController) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForFreshWorker) return;
      reloadingForFreshWorker = true;
      location.reload();
    });
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  }, { once: true });
}

startApplication();