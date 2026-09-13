import { defineConfig } from "vitest/config";

// An .mts file: Vite's native config loader reads ESM syntax from a plain
// .ts file as CommonJS and warns on every run, and web/package.json carries no
// "type": "module" because Next's config and scripts sit beside it.
// The generated bundles carry no tests of their own; the seven suites that
// load the node bundle reach it through createRequire, not the include list.
const NEVER_TESTS = ["node_modules/**", "lib/wasm/**", "lib/wasm-node/**"];

// The lib suites that read window, document, localStorage, or render with
// @testing-library. Derived by running lib/** under the node environment
// and keeping what failed; re-derive the same way when one is added.
const DOM_LIB_TESTS = [
  "lib/test/content/tutorials.test.ts",
  "lib/test/emulator/backend.test.ts",
  "lib/test/emulator/use-console-output.test.ts",
  "lib/test/emulator/use-emulator.test.ts",
  "lib/test/hooks/use-breakpoint.test.ts",
  "lib/test/hooks/use-focus-trap.test.tsx",
  "lib/test/hooks/use-layout-persistence.test.ts",
  "lib/test/hooks/use-named-saves.test.ts",
  "lib/test/hooks/use-source-files.test.ts",
  "lib/test/hooks/use-theme.test.ts",
  "lib/test/hooks/use-zoom.test.ts",
  "lib/test/playground/auto-save.test.ts",
  "lib/test/playground/exercise-answers.test.ts",
  "lib/test/playground/named-saves.test.ts",
  "lib/test/playground/palette-commands.test.ts",
  "lib/test/playground/register-sw.test.ts",
  "lib/test/playground/solved-state.test.ts",
  "lib/test/playground/use-terminal-drive.test.ts",
  "lib/test/playground/use-working-set.test.ts",
];

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    // Two projects over one config: the lib suites that never touch a DOM
    // run under node, because standing up jsdom was nine tenths of the lib
    // suite's wall clock, and everything that renders or reads window
    // stays on jsdom. A lib test that needs the DOM is listed by name in
    // DOM_LIB_TESTS; one that is missing from the list fails under node
    // with a ReferenceError, never silently. Both projects extend this
    // config, so the alias, the setup file, and the coverage floors apply
    // to the union exactly as they did to the single suite.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "lib/**/*.test.ts",
            "lib/**/*.test.tsx",
            // Root-adjacent subjects (next.config.mjs) keep their test beside them.
            "*.test.ts",
          ],
          exclude: [...NEVER_TESTS, ...DOM_LIB_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: [
            "app/**/*.test.ts",
            "app/**/*.test.tsx",
            "components/**/*.test.tsx",
            ...DOM_LIB_TESTS,
          ],
          exclude: NEVER_TESTS,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "lib/wasm/**",
        "lib/wasm-node/**",
        "vitest.config.mts",
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
