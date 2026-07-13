import Link from "next/link";

/**
 * Brand wordmark: the field-box lockup paired with the "aarch64" mono mark,
 * linking home. The lockup draws a 32-bit instruction word as four field
 * cells sharing edges; the third cell is filled amber — the machine bit set —
 * so the brand reads as "the machine acting" at any size. When `showLabel`
 * is set, a quiet "playground" label rides alongside (header on wide
 * viewports, drawer); collapsed, the lockup plus mark stand in as the mark.
 * `"sm-up"` keeps the label out of viewports under the sm breakpoint, where
 * a crowded bar (the 375px nav) cannot spare its width.
 */
export function Wordmark({
  showLabel = false,
  size = "nav",
  className = "",
}: {
  showLabel?: boolean | "sm-up";
  /** `nav` = 57×14 lockup (header); `footer` = 47×12. */
  size?: "nav" | "footer";
  className?: string;
}) {
  // Cell widths per §2.1 of the design system: 24/11/11/11 at nav size,
  // 20/9/9/9 in the footer. Shared edges: interior cells drop one side.
  const cells = size === "nav" ? [24, 11, 11, 11] : [20, 9, 9, 9];
  const height = size === "nav" ? 14 : 12;
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] focus:outline-none focus-visible:[box-shadow:var(--ring)] ${className}`}
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
            showLabel === "sm-up" ? "hidden sm:inline" : ""
          }`}
        >
          playground
        </span>
      ) : null}
      <span className="sr-only"> home</span>
    </Link>
  );
}
