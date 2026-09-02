"use client";

import Link from "next/link";
import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";
import { DieFloorplan } from "@/components/landing/DieFloorplan";
import { HERO_PROGRAM } from "@/lib/content/landing-content";

/**
 * The live landing hero: an amber bit-range kicker, the display headline with
 * the brand block cursor, the serif lead, and (on wide viewports) the die
 * floorplan motif beside the copy, echoing the instrument below. The shared
 * embeddable runs in a package frame (pin stubs on the rails, a live-die-view
 * header band) and autoplays the tiny hero program so the registers flash and
 * the pc marker advances on load. The embed supplies its own loading beat and
 * reduced-motion fallback inherently, so the hero adds no competing motion;
 * it only frames it. The primary action deep-links into the full playground.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 sm:py-16"
    >
      <div className="flex items-start justify-between gap-12">
        <div className="flex max-w-2xl flex-col gap-5">
          <span className="font-mono text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.18em] text-[var(--amber)]">
            [31:0] live emulator · no install · no server
          </span>
          <h1
            id="hero-heading"
            // Steps toward the display size on desktop so the landing opens
            // with a confident voice; phones keep the tighter scale.
            className="font-sans text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-[var(--text-primary)] sm:text-5xl lg:text-6xl lg:tracking-[-0.03em]"
          >
            Look inside the machine
            <span
              aria-hidden="true"
              className="anim-cursor-blink ml-2 inline-block h-[0.8em] w-[0.42em] translate-y-[0.08em] bg-[var(--amber)] align-baseline"
            />
          </h1>
          <p className="text-[var(--text-secondary)] [font:var(--type-lead)]">
            aarch64-playground is a hand-written ARMv8 emulator and visual
            debugger. Paste a program, assemble it, and watch the registers, the
            stack, and memory update as each instruction runs.
          </p>
        </div>
        <DieFloorplan className="mt-2 hidden lg:grid" />
      </div>

      {/* The package frame: pin stubs down both rails, a live-die-view header
          band, then the embed. One fixed embed height at every breakpoint:
          the container-driven embed layout does the arranging, and a static
          frame means the page cannot shift as the editor and emulator
          stream in. */}
      <div className="relative px-0 sm:px-2.5">
        <span
          aria-hidden="true"
          className="absolute bottom-6 left-0 top-6 hidden w-2.5 sm:block"
          style={{
            background:
              "repeating-linear-gradient(180deg, var(--border-strong) 0 8px, transparent 8px 24px)",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-6 right-0 top-6 hidden w-2.5 sm:block"
          style={{
            background:
              "repeating-linear-gradient(180deg, var(--border-strong) 0 8px, transparent 8px 24px)",
          }}
        />
        <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-sunken)] [box-shadow:var(--shadow-frame)]">
          <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-base)] px-4 py-2.5">
            <span aria-hidden="true" className="inline-flex h-[12px]">
              {[10, 5, 5, 5].map((width, index) => (
                <span
                  key={index}
                  className={`inline-block border-y border-r border-[var(--border-strong)] ${
                    index === 0 ? "border-l" : ""
                  } ${index === 2 ? "bg-[var(--amber)]" : ""}`}
                  style={{ width, height: 12 }}
                />
              ))}
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              a64-pg · live die view
            </span>
            <span className="ml-auto hidden font-mono text-[10px] text-[var(--text-tertiary)] sm:inline">
              stepping the hero program · 450ms/instr
            </span>
          </div>
          <div className="flex h-[560px] flex-col">
            <EmbeddablePlayground
              chrome="embed"
              startSource={HERO_PROGRAM}
              autoplay
              // The walk reaches the program's svc on step 9, so the hero prints
              // its line into the embed console during the autoplay.
              autoplaySteps={10}
              readOnly
              // The hero is a demonstration, not a debugger: it keeps the
              // two-button frame the autoplay walk was designed around.
              showStep={false}
              showBack={false}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/playground?example=basics"
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
