import type { JSX } from "react";

/** The 14px pass/fail square with its ✓/✗ glyph, plus text for screen readers. */
export function CheckSquare({ pass }: { pass: boolean }): JSX.Element {
  const tone = pass
    ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]"
    : "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]";
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border font-mono text-[12px] font-bold leading-none ${tone}`}
    >
      <span aria-hidden="true">{pass ? "✓" : "✗"}</span>
      <span className="sr-only">{pass ? "passed" : "failed"}</span>
    </span>
  );
}
