/**
 * Document rule: the datasheet header strip at the top of every reading
 * surface. Mono, uppercase, tertiary ink over a hairline — the segments name
 * the product, the sheet, and its context, with the section segment in amber
 * (the machine pole carries the sheet number, as on a real datasheet).
 * On phones the strip collapses to the product code alone so it never wraps.
 */
export function DocRule({
  section,
  context,
  className = "",
}: {
  /** Sheet identifier, e.g. "SECTION 4 · LEARN"; rendered amber. */
  section?: string;
  /** Right-aligned context, e.g. "CPSC 355 STUDY AID". */
  context?: string;
  className?: string;
}) {
  return (
    <div
      className={`border-b border-[var(--border)] pb-2 font-mono text-[10px] uppercase leading-[1.4] tracking-[0.08em] text-[var(--text-tertiary)] ${className}`}
    >
      <div className="flex items-baseline gap-3">
        <span className="whitespace-nowrap">
          <span className="sm:hidden">aarch64-pg</span>
          <span className="hidden sm:inline">aarch64 playground</span>
        </span>
        {section ? (
          <span className="hidden whitespace-nowrap text-[var(--amber)] sm:inline">
            {section}
          </span>
        ) : null}
        {context ? (
          <span className="ml-auto hidden whitespace-nowrap sm:inline">{context}</span>
        ) : null}
      </div>
    </div>
  );
}
