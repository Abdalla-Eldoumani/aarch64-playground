"use client";

import { useTheme, type Theme } from "@/lib/hooks/use-theme";

// Short visible labels; the aria-label always carries the full "<value> theme".
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "dark" },
  { value: "light", label: "light" },
  { value: "high-contrast", label: "contrast" },
];

/**
 * Drives the shared useTheme hook, so there is no second theme store. One
 * bordered strip rather than three pills, so it reads as a single switch.
 * `comfortable` gives the mobile drawer 44px targets.
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
            className={`touch-target inline-flex items-center justify-center font-sans font-medium transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10 ${sizing} ${
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
