(() => {
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
})();
