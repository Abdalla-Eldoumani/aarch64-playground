"use client";

import Link from "next/link";
import { EmbeddablePlayground } from "@/components/EmbeddablePlayground";
import { HERO_PROGRAM } from "@/lib/landing-content";

/**
 * The live landing hero: the shared embeddable in embed chrome, autoplaying the
 * tiny hero program so the registers flash and the pc marker advances on load.
 * The embed supplies its own loading beat (loading editor / loading emulator)
 * and its reduced-motion static fallback inherently, so the hero adds no
 * competing motion of its own and never forks the component -- it only frames
 * it. The primary action deep-links into the full playground with an example
 * preloaded. A client component because it renders the (client) embeddable.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 sm:py-16"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <h1
          id="hero-heading"
          // Steps toward the display size on desktop so the landing opens
          // with a confident voice; phones keep the tighter scale.
          className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl"
        >
          step through AArch64 assembly, right in your browser
          <span
            aria-hidden="true"
            className="anim-cursor-blink ml-1 inline-block h-[0.9em] w-[0.45em] translate-y-[0.06em] bg-[var(--amber)] align-baseline"
          />
        </h1>
        <p className="text-[var(--text-secondary)] [font:var(--type-lead)]">
          aarch64-playground is a hand-written ARMv8 emulator and visual
          debugger. Paste a program, assemble it, and watch the registers, the
          stack, and memory update as each instruction runs.
        </p>
      </div>

      {/* One fixed height at every breakpoint: the container-driven embed
          layout does the arranging, and a static frame means the page cannot
          shift as the editor and emulator stream in. */}
      <div className="flex h-[560px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]">
        <EmbeddablePlayground
          chrome="embed"
          startSource={HERO_PROGRAM}
          autoplay
          // The walk reaches the program's svc on step 9, so the hero prints
          // its line into the embed console during the autoplay.
          autoplaySteps={10}
          readOnly
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/playground?example=basics"
          // Same hover and press grammar as the base button: the fill takes a
          // step of ink on hover and the control travels one pixel on press.
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-[var(--cyan)] px-5 font-sans text-sm font-medium text-[var(--on-cyan)] transition-colors hover:bg-[color-mix(in_srgb,var(--cyan)_88%,var(--text-primary))] active:translate-y-px focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          Open this example in the playground
        </Link>
      </div>
    </section>
  );
}
