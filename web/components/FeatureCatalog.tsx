import { FEATURES } from "@/lib/landing-content";

/**
 * The feature catalog: one card per FEATURES entry in a responsive,
 * count-agnostic grid -- the columns scale with the breakpoint (1 / 2 / 3),
 * never with the data length -- so adding a capability is a single array entry
 * and the layout holds at three cards and at a dozen. Presentational: a server
 * component, no hooks.
 */
export function FeatureCatalog() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16"
    >
      <h2
        id="features-heading"
        className="mb-6 font-serif text-2xl font-semibold leading-tight text-[var(--text-primary)]"
      >
        what it does
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            data-testid="feature-card"
            className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-5"
          >
            {feature.glyph ? (
              <span className="font-mono text-xs text-[var(--text-tertiary)]">
                {feature.glyph}
              </span>
            ) : null}
            <h3 className="font-sans text-base font-semibold text-[var(--text-primary)]">
              {feature.title}
            </h3>
            <p className="font-sans text-sm leading-relaxed text-[var(--text-secondary)]">
              {feature.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
