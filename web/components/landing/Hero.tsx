import Link from "next/link";
import { DieFloorplan } from "@/components/landing/DieFloorplan";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { HERO_PROGRAM } from "@/lib/content/landing-content";
import { buildShareHash } from "@/lib/playground/share";

// The program the demo walks, as a playground link. It is built on the
// server, so the landing ships the finished href and never the codec.
const PLAYGROUND_HREF = `/playground${buildShareHash({ source: HERO_PROGRAM })}`;

/**
 * The landing hero. A server component: only the demo frame (HeroDemo) ships
 * script. The embed brings its own loading state and reduced-motion fallback,
 * so the hero adds no motion of its own; it only frames it.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 sm:py-16"
    >
      <div className="flex items-start justify-between gap-12">
        <div className="flex max-w-2xl flex-col gap-5">
          <span className="font-mono text-[12px] font-semibold uppercase leading-[1.4] tracking-[0.18em] text-[var(--amber)]">
            runs in your browser · nothing to install
          </span>
          <h1
            id="hero-heading"
            // Steps toward the display size on desktop so the headline holds
            // the width on a desktop viewport; phones keep the tighter scale.
            className="font-sans text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-[var(--text-primary)] sm:text-5xl lg:text-6xl lg:tracking-[-0.03em]"
          >
            Look inside the machine
            <span
              aria-hidden="true"
              className="anim-cursor-blink ml-2 inline-block h-[0.8em] w-[0.42em] translate-y-[0.08em] bg-[var(--amber)] align-baseline"
            />
          </h1>
          <p className="text-[var(--text-secondary)] [font:var(--type-lead)]">
            AArch64 Playground is a hand-written ARMv8 emulator and visual
            debugger. Paste a program, assemble it, and watch the registers, the
            stack, and memory update as each instruction runs.
          </p>
        </div>
        <DieFloorplan className="mt-2 hidden lg:grid" />
      </div>

      <HeroDemo />

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={PLAYGROUND_HREF}
          // Same hover and press grammar as the base button: the fill takes a
          // step of ink on hover and the control travels one pixel on press.
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-[var(--cyan)] px-5 font-sans text-sm font-semibold text-[var(--on-cyan)] transition-colors hover:bg-[color-mix(in_srgb,var(--cyan)_88%,var(--text-primary))] active:translate-y-px focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          Open this example in the playground
        </Link>
      </div>
    </section>
  );
}
