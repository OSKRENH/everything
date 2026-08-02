import matchingWorker from "./matching-entry.js";
import featureWorker from "./entry.js";

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message && !/expected pattern/i.test(message)
    ? message
    : "Не удалось обработать подбор рецептов";
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await matchingWorker.fetch(request, env, ctx);
    } catch (error) {
      let pathname = "";
      try {
        pathname = new URL(request.url).pathname;
      } catch {
        pathname = "";
      }

      if (pathname === "/api/catalog" && request.method === "GET") {
        try {
          return await featureWorker.fetch(request, env, ctx);
        } catch {
          // Ниже вернём безопасную ошибку вместо необработанного исключения.
        }
      }

      return Response.json({ error: safeError(error) }, {
        status: 500,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }
  },
};
