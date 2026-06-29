import Link from "next/link";

/**
 * Brand wordmark: the amber execution block paired with the "aarch64" mono mark,
 * linking home. Amber is the machine acting, so the block reads as the brand at any
 * size. When `showLabel` is set, a quiet "playground" label rides alongside (header
 * on wide viewports, drawer); collapsed, the block plus mark stand in as the mark.
 */
export function Wordmark({
  showLabel = false,
  className = "",
}: {
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] focus:outline-none focus-visible:[box-shadow:var(--ring)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-[12px] w-[12px] rounded-[3px] bg-[var(--amber)]"
      />
      <span className="font-mono text-[15px] font-bold leading-none text-[var(--text-primary)]">
        aarch64
      </span>
      {showLabel ? (
        <span className="font-sans text-[14px] leading-none text-[var(--text-secondary)]">
          playground
        </span>
      ) : null}
      <span className="sr-only"> home</span>
    </Link>
  );
}
