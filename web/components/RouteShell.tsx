import type { ReactNode } from "react";
import { DocRule } from "@/components/DocRule";
import { Kicker } from "@/components/Kicker";

/**
 * Shared page chrome for the content routes (/learn, /practice, /reference):
 * the document rule, the numbered sheet kicker, the serif page <h1>, and a
 * serif editorial lead at a comfortable reading measure — the datasheet
 * grammar every reading surface opens with. With no children it renders a
 * quiet "in progress" placeholder card; real content can be passed as
 * children later without restyling the page head, so the three routes stay
 * thin and identical in shape.
 */
export function RouteShell({
  title,
  lead,
  sheet,
  kicker,
  wide = false,
  children,
}: {
  title: string;
  lead: string;
  /** Sheet number for the kicker, e.g. "04". */
  sheet?: string;
  /** Kicker title; defaults to the page title. */
  kicker?: string;
  /** Content routes with rails (the reference) take the wide measure. */
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`mx-auto w-full px-6 py-10 sm:py-14 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
    >
      <DocRule
        section={sheet ? `sheet ${sheet} · ${kicker ?? title}` : undefined}
        context="cpsc 355 study aid"
        className="mb-8"
      />
      {sheet ? <Kicker number={sheet} title={kicker ?? title} className="mb-5" /> : null}
      <h1 className="font-serif text-4xl font-semibold leading-[1.15] text-[var(--text-primary)]">
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
