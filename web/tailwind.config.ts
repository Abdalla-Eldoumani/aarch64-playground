import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      // The rounded scale resolves to the radius tokens, so the corner
      // doctrine in globals.css holds everywhere a utility is used and
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
  plugins: [],
};

export default config;
