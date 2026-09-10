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
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "components/**/*.test.tsx",
      // Root-adjacent subjects (next.config.mjs) keep their test beside them.
      "*.test.ts",
    ],
    // WASM bindings and monaco are browser-only; tests never import them.
    exclude: ["node_modules/**", "lib/wasm/**", "lib/wasm-node/**"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "lib/wasm/**",
        "lib/wasm-node/**",
        "vitest.config.ts",
        "vitest.setup.ts",
      ],
      // A floor so coverage cannot silently regress. Set a few points below
      // current so an ordinary change does not trip it; raise as coverage grows.
      // CI runs the suite in shards, and a shard only sees its slice of the
      // coverage, so shards set VITEST_SHARD to defer the floor to the one
      // merged report (`vitest run --merge-reports --coverage`).
      thresholds: process.env.VITEST_SHARD
        ? undefined
        : {
            statements: 70,
            branches: 63,
            functions: 60,
            lines: 70,
          },
    },
  },
});
