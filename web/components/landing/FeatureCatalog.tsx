import { FEATURES } from "@/lib/content/landing-content";
import { Kicker } from "@/components/ui/Kicker";

/**
 * Ruled rows rather than cards, so the landing reads as one listing. The rows
 * are not interactive, so no hover states. The grid does not care about the
 * count: a new capability is one FEATURES entry.
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
