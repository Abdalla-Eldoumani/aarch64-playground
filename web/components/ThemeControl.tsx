"use client";

import { useTheme, type Theme } from "@/lib/use-theme";

// Short visible labels; the aria-label always carries the full "<value> theme".
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "dark" },
  { value: "light", label: "light" },
  { value: "high-contrast", label: "contrast" },
];

/**
 * Three-way theme selector (dark / light / high-contrast) that drives the shared
 * useTheme hook, so it introduces no second theme store and reuses the existing
 * cycle order and persistence. One segmented control — a bordered strip with
 * hairline separators — rather than three loose pills, so the selector reads as
 * a single instrument switch. The active cell reads cyan and carries
 * aria-pressed; the rest stay quiet until hovered. `comfortable` gives 44px
 * targets for the mobile drawer; `compact` is the smaller top-bar size.
 */
export function ThemeControl({
  size = "compact",
  className = "",
}: {
  size?: "compact" | "comfortable";
  className?: string;
}) {
  const [theme, , setTheme] = useTheme();
  const sizing =
    size === "comfortable"
      ? "min-h-[44px] px-3 text-[13px]"
      : "min-h-[32px] px-2.5 text-[12px]";

  return (
    <div
      role="group"
      aria-label="theme"
      className={`inline-flex items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] ${className}`}
    >
      {OPTIONS.map(({ value, label }, index) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={`${value} theme`}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center justify-center font-sans font-medium transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10 ${sizing} ${
              index > 0 ? "border-l border-[var(--border)]" : ""
            } ${
              active
                ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
