import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
// A relative path: Tailwind loads this file outside the bundler, where the
// `@/` alias does not resolve.
import { themeCssBlocks } from "./lib/theme/tokens";

const config: Config = {
  // lib/ is scanned because the shared syntax highlighter keeps its class map
  // there (lib/asm/highlight-arm64.ts); without the glob its arbitrary
  // `--syntax-*` color utilities are never generated and code renders unlit.
  // Tests are left out: the style guards hold sample classes (hex colours,
  // faded text) that must never reach the shipped stylesheet.
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "!./**/test/**",
    "!./**/*.test.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      // The rounded scale resolves to the radius tokens, so the corner
      // rules in globals.css hold everywhere a utility is used and
      // no element can carry a framework default.
      borderRadius: {
        none: "0",
        sm: "var(--radius-control)",
        DEFAULT: "var(--radius-control)",
        md: "var(--radius-card)",
        lg: "var(--radius-card)",
        xl: "var(--radius-modal)",
        "2xl": "var(--radius-modal)",
      },
      // Same for motion: transition utilities run on the design system's
      // own curve and duration, never the framework default 150ms ease.
      transitionTimingFunction: {
        DEFAULT: "var(--ease)",
      },
      transitionDuration: {
        DEFAULT: "var(--dur-ui)",
      },
    },
  },
  // Every theme's colour tokens, written as custom properties into the base
  // layer from the one TypeScript source the editor and terminal read too.
  plugins: [plugin(({ addBase }) => addBase(themeCssBlocks()))],
};

export default config;
