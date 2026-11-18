import nextConfig from "eslint-config-next";

const TS = "**/*.{ts,tsx}";
const TESTS = ["components/test/**", "lib/test/**", "**/*.test.ts", "**/*.test.tsx"];

// Import boundaries. In flat config the last block that sets a rule replaces
// its options, so each block below lists its files' whole set.

// Each owner file is left out of its own entry. Flagged in a component:
// `import { Editor } from "@/components/playground/Editor"`.
const OWNED = [
  {
    name: "@/components/playground/Editor",
    owners: ["components/playground/lazy-editor.tsx"],
    message: "Import Editor from @/components/playground/lazy-editor: a static import puts Monaco in every page that mounts this one.",
  },
  {
    name: "@/components/playground/FullChromeSurface",
    owners: ["components/playground/lazy-full-chrome.tsx"],
    message: "Load it through @/components/playground/lazy-full-chrome, which also waits for the fonts.",
  },
  {
    name: "@/components/playground/StepGoals",
    owners: ["components/playground/lazy-step-goals.tsx"],
    message: "Load it through @/components/playground/lazy-step-goals, so the hero never carries it.",
  },
  {
    name: "@/components/panels/FramesView",
    owners: [],
    message: "Load it through @/components/playground/lazy-frames: it ships in the frames chunk.",
  },
  {
    name: "@/components/panels/PointerChips",
    owners: [],
    message: "Load it with import(), as RegisterPanel does: it ships in the frames chunk.",
  },
  {
    name: "@/components/panels/CallCard",
    owners: [],
    message: "Load it through @/components/playground/lazy-call-card: it ships in its own chunk.",
  },
  {
    name: "react-markdown",
    owners: ["components/learn/LessonMarkdown.tsx"],
    message: "Render author Markdown through @/components/learn/LessonMarkdown, the sanitizing pipeline.",
  },
  {
    name: "lz-string",
    owners: ["lib/playground/share.ts", "lib/playground/diagnostic-bundle.ts"],
    message: "Encode through @/lib/playground/share or diagnostic-bundle: lz-string must stay off the landing.",
  },
];

// Flagged outside lib/emulator, in non-test files: `import { useBreakpoints } from "@/lib/emulator/use-breakpoints"`.
const COMPOSED = {
  group: ["@/lib/emulator/use-*", "!@/lib/emulator/use-emulator"],
  allowImportNames: ["IDLE_CPU_VIEW"],
  message: "Read this state through useEmulator (@/lib/emulator/use-emulator), which composes it.",
};

// React and its entry points (react/jsx-runtime, react-dom/client).
const noReact = (message) => ({ group: ["react", "react/*", "react-dom", "react-dom/*"], message });

// The embed, EmbeddableCore (the embed imports it), HeroDemo, LessonArticle and
// ExerciseView (they import the embed) and Hero (it imports HeroDemo).
const EMBED_CARRIERS = [
  "@/components/playground/EmbeddablePlayground",
  "@/components/playground/EmbeddableCore",
  "@/components/landing/Hero",
  "@/components/landing/HeroDemo",
  "@/components/learn/LessonArticle",
  "@/components/practice/ExerciseView",
];

const restrict = (paths, patterns = []) => [
  "error",
  {
    paths: paths.map(({ owners, ...path }) => ({ allowTypeImports: true, ...path })),
    patterns: patterns.map((pattern) => ({ allowTypeImports: true, ...pattern })),
  },
];

const ownedExcept = (file) => OWNED.filter((path) => !path.owners.includes(file));

const boundaries = [
  {
    files: [`{app,components,lib}/${TS}`],
    ignores: TESTS,
    rules: { "@typescript-eslint/no-restricted-imports": restrict(OWNED, [COMPOSED]) },
  },
  ...OWNED.flatMap((path) => path.owners).map((file) => ({
    files: [file],
    rules: { "@typescript-eslint/no-restricted-imports": restrict(ownedExcept(file), [COMPOSED]) },
  })),
  {
    files: [`lib/emulator/${TS}`],
    ignores: TESTS,
    rules: { "@typescript-eslint/no-restricted-imports": restrict(OWNED) },
  },
  {
    files: [`lib/emulator/${TS}`],
    ignores: [...TESTS, "lib/emulator/use-*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict(OWNED, [
        noReact("Pure helpers stay pure: React state lives in use-emulator.ts and its use-* modules."),
        {
          group: ["@/lib/wasm/*", "@/lib/wasm-node/*"],
          message: "Pure helpers stay pure: the wasm loads in emulator.ts and the worker.",
        },
      ]),
    },
  },
  {
    files: [`lib/asm/${TS}`],
    ignores: TESTS,
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict(OWNED, [
        noReact("lib/asm is text in, data out: no React."),
        {
          group: ["@/lib/emulator/*", "@/lib/worker/*", "@/lib/wasm/*", "@/lib/wasm-node/*"],
          message: "lib/asm is text in, data out: take the emulator's types with import type, never its calls.",
        },
      ]),
    },
  },
  {
    files: ["lib/worker/emulator.worker.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict(OWNED, [
        noReact("The worker has no DOM: React stays on the main thread."),
        {
          group: [
            "@/components/*",
            "@/lib/hooks/*",
            "@/lib/playground/*",
            "@/lib/content/*",
            "@/lib/terminal/*",
            "@/lib/emulator/use-*",
          ],
          message: "The worker loads the wasm, lib/worker and lib/emulator's pure helpers only: main-thread modules stay out of its chunk.",
        },
      ]),
    },
  },
  {
    files: ["components/practice/ExerciseIndex.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict(
        [
          ...OWNED,
          {
            name: "@/components/learn/LessonMarkdown",
            message: "Render each blurb on the server in the practice page and pass the nodes in as blurbs: LessonMarkdown here puts react-markdown on /practice.",
          },
        ],
        [COMPOSED],
      ),
    },
  },
  {
    files: [`components/reference/${TS}`, `app/**/reference/${TS}`],
    ignores: TESTS,
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict(
        [
          ...OWNED,
          ...EMBED_CARRIERS.map((name) => ({
            name,
            message: "Load the embed with next/dynamic or React.lazy, so the /reference route chunk stays free of it.",
          })),
        ],
        [COMPOSED],
      ),
    },
  },
  // The @/ alias. Scope: app, components and lib, tests included, except lib/theme
  // (tailwind.config.ts loads tokens.ts outside the bundler, where @/ does not
  // resolve) and app tests; a stylesheet beside the file or one level up
  // (`./x.css`, `../x.css`) passes; a deeper relative stylesheet path is flagged.
  // Flagged in a component: `import type { SelectOption } from "../ui/Select"`.
  {
    files: [`{app,components,lib}/${TS}`],
    ignores: ["lib/theme/**", "app/**/*.test.ts", "app/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "!*.css"],
              message: "Import through the @/ alias: @/lib/<group>/<module> or @/components/<group>/<Name>.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/playground/args.ts", "lib/playground/example-catalog.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: ".",
              message: "This file imports nothing: scripts/verify-corpus.js and parity-sweep.js load it through Node's type stripping, with no path resolver.",
            },
          ],
        },
      ],
    },
  },
  // One way to store, one picker, one footer, and Monaco's trimmed feature list.
  {
    files: [`{app,components,lib}/${TS}`],
    ignores: [...TESTS, "lib/playground/safe-storage.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Read and write through @/lib/playground/safe-storage, which survives a blocked storage." },
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].map((object) => ({
          object,
          property: "localStorage",
          message: "Read and write through @/lib/playground/safe-storage, which survives a blocked storage.",
        })),
      ],
    },
  },
  {
    files: [`{app,components}/${TS}`],
    ignores: [...TESTS, "components/chrome/SiteFooter.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXOpeningElement[name.name='select']", message: "Use @/components/ui/Select: a native select ignores the theme." },
        { selector: "JSXOpeningElement[name.name='footer']", message: "Use @/components/chrome/SiteFooter, the one footer: no per-page footers." },
        {
          selector: "ImportDeclaration[source.value=/register\\.all/], ImportExpression[source.value=/register\\.all/]",
          message: "Load Monaco's features from @/components/playground/monaco-features: register.all also pulls inlineCompletions.",
        },
      ],
    },
  },
];

const config = [
  ...nextConfig,
  {
    ignores: ["lib/wasm/**", "lib/wasm-node/**", "coverage/**"],
  },
  ...boundaries,
];

export default config;
