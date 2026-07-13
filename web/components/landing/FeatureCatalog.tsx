import { FEATURES } from "@/lib/content/landing-content";
import { Kicker } from "@/components/ui/Kicker";

/**
 * The capability listing: one ruled row per FEATURES entry, read like a
 * datasheet rather than a wall of cards. Each row is a mono glyph column (the
 * mnemonic) beside the capability and its one-line description, separated by
 * hairline rules -- the same table grammar as the jump table above it, so the
 * landing reads as machine listings, not marketing tiles. The rows are not
 * interactive and do not pretend to be: no hover states, no card chrome. The
 * grid is count-agnostic (rows flow into two columns from lg up), so adding a
 * capability is a single array entry at three rows or a dozen. Presentational:
 * a server component, no hooks.
 */
export function FeatureCatalog() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16"
    >
      <h2 id="features-heading" className="sr-only">
        what it does
      </h2>
      <Kicker number="02" title="what it does" className="mb-4" />
      <ul className="grid gap-x-12 lg:grid-cols-2">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            data-testid="feature-card"
            className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 border-t border-[var(--border)] py-4"
          >
            <span
              aria-hidden="true"
              className="font-mono text-[12px] leading-[1.55] text-[var(--text-tertiary)]"
            >
              {feature.glyph ?? ""}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-sans text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
                {feature.title}
              </h3>
              <p className="font-sans text-sm leading-relaxed text-[var(--text-secondary)]">
                {feature.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
