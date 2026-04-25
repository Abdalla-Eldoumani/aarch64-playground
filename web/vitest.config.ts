import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "app/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    // WASM bindings and monaco are browser-only; tests never import them.
    exclude: ["node_modules/**", "lib/wasm/**", "lib/wasm-node/**"],
  },
});
