import type { ReactNode } from "react";

/**
 * Shared empty-state chrome for the content routes (/learn, /practice,
 * /reference): the page <h1> and a serif editorial lead at a comfortable reading
 * measure. With no children it renders a quiet "in progress" placeholder card;
 * real content can be passed as children later without restyling the page head,
 * so the three routes stay thin and identical in shape.
 */
export function RouteShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)]">
        {title}
      </h1>
      <p className="mt-4 text-[var(--text-secondary)] [font:var(--type-lead)]">
        {lead}
      </p>
      {children ?? (
        <div className="mt-10 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-6">
          <p className="font-sans text-sm leading-relaxed text-[var(--text-tertiary)]">
            This section is being built and will arrive soon.
          </p>
        </div>
      )}
    </section>
  );
}
