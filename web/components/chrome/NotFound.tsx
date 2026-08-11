import Link from "next/link";

interface NotFoundProps {
  title?: string;
  message?: string;
  returnHref?: string;
  returnLabel?: string;
}

/**
 * The 404 sheet: a document rule announcing the missing sheet by its hex
 * address, the serif head, a mono gloss in the decode strip's voice (a
 * branch to a target that does not exist), and a primary route home.
 */
export function NotFound({
  title = "page not found",
  message = "the address you requested isn't mapped.",
  returnHref = "/playground",
  returnLabel = "return to playground",
}: NotFoundProps) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex flex-col items-center justify-center flex-1 min-h-0 gap-6 px-6 text-center"
      role="main"
    >
      <div className="flex items-baseline gap-3 border-b border-[var(--border)] pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        <span>sheet not found</span>
        <span className="text-[var(--danger)]">0x00000404</span>
        <span>signal 11</span>
      </div>

      <h1 className="font-serif text-3xl font-semibold text-[var(--text-primary)]">{title}</h1>

      <p className="max-w-md font-sans text-sm text-[var(--text-secondary)]">{message}</p>

      <p className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
        b 0x404 -- branch target does not exist
      </p>

      <Link
        href={returnHref}
        className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-[var(--cyan)] px-5 font-sans text-sm font-semibold text-[var(--on-cyan)] transition-colors hover:bg-[color-mix(in_srgb,var(--cyan)_88%,var(--text-primary))] active:translate-y-px focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        {returnLabel}
      </Link>
    </main>
  );
}
