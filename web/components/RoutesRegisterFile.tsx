import Link from "next/link";
import { ROUTE_REGISTERS } from "@/lib/landing-content";

/**
 * The site routes rendered as a register file / memory map: each destination is
 * a row with a mono register-style label (x0..x3), the destination name, and
 * its route address in the right "value" column, echoing RegisterRow's grammar
 * (mono labels, aligned columns, tabular value) so the block reads as a register
 * table rather than a generic card row. The playground is the cyan primary (x0);
 * Learn / Practice / Reference are quiet rows that go cyan on hover/focus. The
 * hrefs come from ROUTE_REGISTERS, which derives them from NAV_ROUTES, so the
 * addresses never drift. A server component -- it ships no client JS.
 */
export function RoutesRegisterFile() {
  return (
    <section
      aria-labelledby="routes-heading"
      className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16"
    >
      <h2
        id="routes-heading"
        className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--text-tertiary)]"
      >
        jump table
      </h2>
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]">
        {ROUTE_REGISTERS.map((route) => (
          <li key={route.href}>
            <Link
              href={route.href}
              className={`grid min-h-[44px] grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                route.primary
                  ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-raised)] hover:text-[var(--cyan)]"
              }`}
            >
              <span
                className={`font-mono text-[13px] ${
                  route.primary
                    ? "text-[var(--on-cyan)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {route.reg}
              </span>
              <span className="font-sans text-sm font-medium">{route.label}</span>
              <span
                className={`text-right font-mono text-[12px] tabular-nums ${
                  route.primary
                    ? "text-[var(--on-cyan)]"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
                {route.href}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
