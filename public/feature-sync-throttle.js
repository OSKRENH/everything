(() => {
  const originalFetch = window.fetch.bind(window);
  const interval = 4000;
  let lastSentAt = 0;
  let timer = 0;
  let pending = null;

  function requestDetails(input, init = {}) {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
    const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    return { url, method };
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
    const { url, method } = requestDetails(input, init);
    if (url.pathname !== "/api/feature-state" || method !== "PUT") return originalFetch(input, init);

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
