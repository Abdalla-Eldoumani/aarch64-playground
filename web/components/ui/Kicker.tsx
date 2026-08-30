/**
 * Numbered section kicker: `NN · TITLE` in the datasheet voice. The number
 * in amber (the sheet's machine coordinate), the title in tertiary mono,
 * then a hairline that runs out the measure. Heads every numbered section on
 * the landing and reading surfaces.
 */
export function Kicker({
  number,
  title,
  className = "",
}: {
  /** Section number, e.g. "01" or "4.3". */
  number: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${className}`}>
      <span className="font-mono text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.18em]">
        <span className="text-[var(--amber)]">{number}</span>
        <span className="text-[var(--text-tertiary)]"> · {title}</span>
      </span>
      <span aria-hidden="true" className="flex-1 translate-y-[-3px] border-t border-[var(--border)]" />
    </div>
  );
}
