/**
 * The small header strip at the top of each reading page: the site name, a
 * section label in amber, and a context label on the right. Phones show only
 * the short name so the strip never wraps.
 */
export function DocRule({
  section,
  context,
  className = "",
}: {
  /** Section label, e.g. "learn"; rendered amber. */
  section?: string;
  /** Right-aligned context, e.g. "cpsc 355 study aid". */
  context?: string;
  className?: string;
}) {
  return (
    <div
      className={`border-b border-[var(--border)] pb-2 font-mono text-[12px] uppercase leading-[1.4] tracking-[0.08em] text-[var(--text-tertiary)] ${className}`}
    >
      <div className="flex items-baseline gap-3">
        <span className="whitespace-nowrap">
          <span className="sm:hidden">aarch64-pg</span>
          <span className="hidden sm:inline">aarch64 playground</span>
        </span>
        {/* A lesson's section names it by title; where a long one meets a
            narrow sheet it ends in an ellipsis, since the h1 below says it whole. */}
        {section ? (
          <span className="hidden min-w-0 truncate text-[var(--amber)] sm:inline">
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
