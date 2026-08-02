window.fetch = async function kutnoSafeMatchingFetch(input, init = {}) {
  let method = String(init.method || "GET").toUpperCase();
  let pathname = "";

  if (typeof Request !== "undefined" && input instanceof Request) {
    method = String(init.method || input.method || "GET").toUpperCase();
    try {
      pathname = new URL(input.url).pathname;
    } catch {
      pathname = "";
    }
  } else if (typeof input === "string") {
    pathname = input.split("?", 1)[0];
    if (/^https?:\/\//i.test(pathname)) {
      try {
        pathname = new URL(input).pathname;
      } catch {
        pathname = "";
      }
    }
  } else if (typeof URL !== "undefined" && input instanceof URL) {
    pathname = input.pathname;
  }

  let nextInit = init;
  if (pathname === "/api/generate" && method === "POST" && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      body.baseIngredients = matchingBaseIngredients();
      nextInit = { ...init, body: JSON.stringify(body) };
    } catch {
      // Отправляем исходное тело запроса.
    }
  }

  const response = await kutnoFetchBeforeMatching(input, nextInit);
  if (pathname === "/api/generate" && method === "POST") {
    response.clone().json().then((data) => {
      matchingRelaxation = data?.relaxation || null;
    }).catch(() => {});
  }
  return response;
};
