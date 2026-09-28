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
  "lib/test/playground/walkthrough.test.ts",
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
    // Lib suites that never touch a DOM run under node, since starting jsdom
    // was nine tenths of their run time. A lib test that needs the DOM but is
    // missing from DOM_LIB_TESTS fails under node with a ReferenceError,
    // never silently.
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
      // Everything that ships, whether or not a test imports it: without a
      // list, a module no test reached was left out of the count entirely.
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "components/test/**",
        "lib/test/**",
        "lib/wasm/**",
        "lib/wasm-node/**",
      ],
      // A floor so coverage cannot silently regress: about five points under
      // what was measured when it was set (88.2 / 85.9 / 84.9 / 89.6), so an
      // ordinary change does not trip it; raise it as coverage grows.
      // CI runs the suite in shards, and a shard only sees its slice of the
      // coverage, so shards set VITEST_SHARD to defer the floor to the one
      // merged report (`vitest run --merge-reports --coverage`).
      thresholds: process.env.VITEST_SHARD
        ? undefined
        : {
            statements: 83,
            branches: 80,
            functions: 79,
            lines: 84,
          },
    },
  },
});
