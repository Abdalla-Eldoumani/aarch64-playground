import Link from "next/link";
import type { CSSProperties } from "react";
import { ROUTE_REGISTERS } from "@/lib/content/landing-content";
import { Kicker } from "@/components/ui/Kicker";
import { BootFlashList } from "@/components/diagrams/BootFlashList";

/** Micro field-box: the wordmark's four-cell lockup at row scale, with the
 *  row's own bit lit. */
function MicroFieldBox({ lit, onPrimary }: { lit: number; onPrimary: boolean }) {
  const stroke = onPrimary ? "border-[var(--on-cyan)]" : "border-[var(--border-strong)]";
  const fill = onPrimary ? "bg-[var(--on-cyan)]" : "bg-[var(--cyan)]";
  return (
    <span aria-hidden="true" className="inline-flex h-[10px]">
      {[0, 1, 2, 3].map((cell) => (
        <span
          key={cell}
          className={`inline-block border-y border-r ${stroke} ${
            cell === 0 ? "border-l" : ""
          } ${cell === lit ? fill : ""}`}
          style={{ width: cell === 0 ? 14 : 8, height: 10 }}
        />
      ))}
    </span>
  );
}

/**
 * The site's routes drawn as a register table, matching RegisterRow. Hrefs
 * come from ROUTE_REGISTERS, derived from NAV_ROUTES, so they never drift.
 * A server component: its only client code is BootFlashList.
 */
export function RoutesRegisterFile() {
  return (
    <section
      aria-labelledby="routes-heading"
      className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16"
    >
      <h2 id="routes-heading" className="sr-only">
        where to go
      </h2>
      <Kicker number="01" title="where to go" className="mb-4" />
      <BootFlashList className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-sunken)]">
        {ROUTE_REGISTERS.map((route, index) => (
          // Each row plays the register-write flash once the list arms itself
          // after mount, staggered 70ms per row so the block powers on like
          // values landing in a register file, top to bottom. CSS with no
          // movement or hidden start state: nothing shifts, and under
          // prefers-reduced-motion the rows are static.
          <li
            key={route.href}
            className="anim-boot-flash"
            style={{ "--boot-delay": `${index * 70}ms` } as CSSProperties}
          >
            <Link
              href={route.href}
              // Plain false, not the nav's hover wrapper: that wrapper needs
              // state and this file is a server component on purpose (see
              // above). The nav carries the hover path for pointer users.
              prefetch={false}
              className={`grid min-h-[48px] grid-cols-[5.5rem_1fr_auto] items-center gap-3 px-4 transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                route.primary
                  ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-raised)] hover:text-[var(--cyan)]"
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <MicroFieldBox lit={index} onPrimary={Boolean(route.primary)} />
                <span
                  className={`font-mono text-[13px] ${
                    route.primary
                      ? "text-[var(--on-cyan)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {route.reg}
                </span>
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
      </BootFlashList>
    </section>
  );
}
