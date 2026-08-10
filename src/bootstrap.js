const STYLE_URLS = [
  "/auth-fix.css?v=4",
  "/section-typography.css?v=11",
  "/kutno-features.css?v=2",
  "/matching-engine.css?v=1",
  "/matching-mobile-fix.css?v=1",
  "/catalog-stability.css?v=4",
  "/manual-mode.css?v=1",
  "/kutno-next.css?v=1",
  "/recipe-photos.css?v=1",
  "/mobile-recipe-ux.css?v=2",
];

function setShellStatus(message, failed = false) {
  const shell = document.querySelector("[data-kutno-shell]");
  const status = document.querySelector("[data-kutno-shell-status]");
  if (!shell || !status) return;
  status.textContent = message;
  shell.classList.toggle("is-delayed", failed);
}

function startStyles() {
  for (const href of STYLE_URLS) {
    if (document.querySelector(`link[href=\"${href}\"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }
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
  startStyles();
  installFeatureSyncThrottle();
  setShellStatus("Загружаем кухню…");

  try {
    await import("./main.js");
    await import("./public-routes.js");
    await loadPublicModule("/mobile-recipe-ux.js?v=1");
    document.documentElement.dataset.kutnoReady = "true";
    window.dispatchEvent(new CustomEvent("kutno:ready"));

    const loadExtras = () => Promise.allSettled([
      loadPublicModule("/kutno-features.js?v=5"),
      loadPublicModule("/recipe-photos.js?v=1"),
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
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, { once: true });
}

startApplication();
