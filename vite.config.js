import fs from "node:fs";
import { defineConfig } from "vite";

const bridgeSource = fs.readFileSync(new URL("./src/kutno-bridge.inject.js", import.meta.url), "utf8");

export default defineConfig({
  plugins: [
    {
      name: "kutno-runtime-bridge",
      enforce: "post",
      transform(code, id) {
        const cleanId = id.split("?", 1)[0];
        if (!cleanId.endsWith("/src/main.js")) return null;
        return {
          code: `${code}\n\n${bridgeSource}`,
          map: null,
        };
      },
    },
  ],
});
