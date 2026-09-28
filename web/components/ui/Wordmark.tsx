import Link from "next/link";

/**
 * Site logo linking home: four boxes for the fields of a 32-bit instruction,
 * then "aarch64", then an optional "playground" label. `"sm-up"` hides the
 * label under sm and in the md band, where the nav bar has no room for it.
 */
export function Wordmark({
  showLabel = false,
  size = "nav",
  className = "",
}: {
  showLabel?: boolean | "sm-up";
  /** `nav` = 57×14 logo (header); `footer` = 47×12. */
  size?: "nav" | "footer";
  className?: string;
}) {
  // Only the first cell draws a left border, so neighbours share one edge.
  const cells = size === "nav" ? [24, 11, 11, 11] : [20, 9, 9, 9];
  const height = size === "nav" ? 14 : 12;
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] [@media(pointer:coarse)]:min-h-[44px] focus:outline-none focus-visible:[box-shadow:var(--ring)] ${className}`}
    >
      <span aria-hidden="true" className="inline-flex" style={{ height }}>
        {cells.map((width, index) => (
          <span
            key={index}
            className={`inline-block border-y border-[var(--border-strong)] ${
              index === 0 ? "border-l" : ""
            } border-r ${index === 2 ? "bg-[var(--amber)]" : ""}`}
            style={{ width, height }}
          />
        ))}
      </span>
      <span className="font-mono text-[15px] font-bold leading-none tracking-[-0.01em] text-[var(--text-primary)]">
        aarch64
      </span>
      {showLabel ? (
        <span
          className={`font-sans text-[14px] leading-none text-[var(--text-secondary)] ${
            showLabel === "sm-up" ? "hidden sm:inline md:hidden lg:inline" : ""
          }`}
        >
          playground
        </span>
      ) : null}
      <span className="sr-only"> home</span>
    </Link>
  );
}
