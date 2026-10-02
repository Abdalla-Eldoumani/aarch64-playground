"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/chrome/SiteIcons";
import {
  OFFER_TARGETS,
  WALKTHROUGH_STEPS,
  loadProgress,
  placeCard,
  placeOverBar,
  resolveTarget,
  saveProgress,
  type Box,
  type Placement,
} from "@/lib/playground/walkthrough";

export interface InterfaceWalkthroughProps {
  /** Bumped by the tutorials panel and the palette: open where the student
   *  left off. Zero asks for nothing. */
  openRequest: number;
}

type Mode = { kind: "closed" } | { kind: "offer" } | { kind: "open"; step: number };

interface Layout {
  ring: Box | null;
  card: Placement | null;
  hint?: string;
  /** A modal dialog or a picker's list is up; the walkthrough waits under it. */
  hidden: boolean;
  /** The offer laid over a phone's top bar: its title and buttons only. */
  compact?: boolean;
}

// Past the first paint, so the offer lands on a settled page.
const OFFER_DELAY_MS = 1200;
// Tab switches, lazy panes and a rotating phone move targets without an
// event to hear, so the card re-measures on a short beat while it is up.
const SYNC_MS = 400;
const CARD_WIDTH = 352;
const RING_PAD = 4;

const CLOSED: Mode = { kind: "closed" };
const EMPTY: Layout = { ring: null, card: null, hidden: false };

function sameLayout(a: Layout, b: Layout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * A tour of the playground, one part at a time. A view that fills a phone
 * leaves no room beside it, so there the card sits low over the view, clear
 * of its header. It is not modal, so a student can press the button the card
 * is talking about; it steps aside while a dialog or a picker's list is open.
 * The card lives in the top layer (the popover API) so no panel's overflow can
 * clip it; without the API it is a fixed layer. `/playground?walkthrough`
 * opens it at the start.
 */
export function InterfaceWalkthrough({ openRequest }: InterfaceWalkthroughProps) {
  const [deepLinked] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("walkthrough"),
  );
  const [mode, setMode] = useState<Mode>(deepLinked ? { kind: "open", step: 0 } : CLOSED);
  const [layout, setLayout] = useState<Layout>(EMPTY);
  // A request is applied during the render that sees it. Starting from zero
  // honours one made before this lazily loaded module arrived.
  const [seenRequest, setSeenRequest] = useState(0);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    if (openRequest !== 0) setMode({ kind: "open", step: loadProgress().step });
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const focusPendingRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();
  const nextId = useId();

  // First visit: offer once. A deep link has already started it.
  useEffect(() => {
    if (deepLinked) {
      saveProgress({ offered: true, step: 0 });
      return;
    }
    if (loadProgress().offered) return;
    const timer = setTimeout(() => {
      // Shown is enough: a student who ignores it is not asked again.
      saveProgress({ ...loadProgress(), offered: true });
      setMode((m) => (m.kind === "closed" ? { kind: "offer" } : m));
    }, OFFER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [deepLinked]);

  const goTo = useCallback((step: number) => {
    saveProgress({ offered: true, step });
    setMode({ kind: "open", step });
  }, []);

  const close = useCallback(() => {
    setMode(CLOSED);
    focusPendingRef.current = false;
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    // Focus left in the card would fall to the top of the page when it
    // unmounts. The opener is often gone by now (the offer, the tutorials
    // panel, the palette), so the way back in the offer named takes it.
    const active = document.activeElement;
    if (active && active !== document.body && !cardRef.current?.contains(active)) return;
    back?.focus();
    if (back && document.activeElement === back) return;
    const way = resolveTarget(OFFER_TARGETS)?.el;
    if (way instanceof HTMLElement) way.focus();
  }, []);

  const finish = useCallback(() => {
    saveProgress({ offered: true, step: 0 });
    close();
  }, [close]);

  const sync = useCallback(() => {
    const card = cardRef.current;
    if (!card || mode.kind === "closed") return;
    // A picker's open list is a sheet on a phone, and the card in the top
    // layer would sit on its options. Found by the open trigger: Monaco keeps
    // a hidden listbox in the page once its suggestions have shown.
    const hidden = document.querySelector('[aria-modal="true"], [aria-haspopup="listbox"][aria-expanded="true"]') !== null;
    const targets = mode.kind === "offer" ? OFFER_TARGETS : WALKTHROUGH_STEPS[mode.step].targets;
    const found = hidden ? null : resolveTarget(targets);
    const view = { width: window.innerWidth, height: window.innerHeight };
    // The text's full length, not the capped box: measuring the capped card
    // would call it short enough to lift the cap, and the two would take
    // turns on every beat.
    const text = textRef.current;
    const hiddenText = text ? text.scrollHeight - text.clientHeight : 0;
    const size = { width: CARD_WIDTH, height: card.offsetHeight + hiddenText };
    if (!found) {
      const width = Math.min(CARD_WIDTH, view.width - 16);
      const next: Layout = {
        ring: null,
        hidden,
        card: {
          side: "over",
          width,
          maxHeight: null,
          left: view.width - 8 - width,
          top: Math.max(8, view.height - 8 - size.height),
        },
      };
      setLayout((prev) => (sameLayout(prev, next) ? prev : next));
      return;
    }
    const r = found.el.getBoundingClientRect();
    const box = (b: DOMRect) => ({ top: b.top, left: b.left, width: b.width, height: b.height });
    if (found.overBar) {
      // The card covers the target, so no ring: it would frame the card.
      const next: Layout = { ring: null, hidden, compact: true, card: placeOverBar(box(r), CARD_WIDTH, view) };
      setLayout((prev) => (sameLayout(prev, next) ? prev : next));
      return;
    }
    const avoid = (found.avoid ?? []).flatMap((selector) => {
      const control = resolveTarget([{ selector }]);
      return control ? [box(control.el.getBoundingClientRect())] : [];
    });
    const ringTop = Math.max(0, r.top - RING_PAD);
    const ringLeft = Math.max(0, r.left - RING_PAD);
    const next: Layout = {
      hidden,
      hint: found.hint,
      card: placeCard(box(r), size, view, avoid),
      ring: {
        top: ringTop,
        left: ringLeft,
        width: Math.min(view.width, r.right + RING_PAD) - ringLeft,
        height: Math.min(view.height, r.bottom + RING_PAD) - ringTop,
      },
    };
    setLayout((prev) => (sameLayout(prev, next) ? prev : next));
  }, [mode]);

  // Into the top layer once the layer mounts; unmounting takes it back out.
  const shown = mode.kind !== "closed";
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!shown || !root || typeof root.showPopover !== "function") return;
    try {
      root.showPopover();
    } catch {
      // Already showing: nothing to do.
    }
  }, [shown]);

  useLayoutEffect(() => {
    if (mode.kind === "closed") return;
    sync();
    const timer = setInterval(sync, SYNC_MS);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [mode, sync]);

  // Starting moves focus to next, so the keyboard can walk on with Enter;
  // the offer takes no focus, since it arrives on its own. The move waits
  // for the card's first placement: until then it is hidden, and a hidden
  // button refuses focus without a word.
  const started = mode.kind === "open";
  useEffect(() => {
    if (!started) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !cardRef.current?.contains(active)) {
      returnFocusRef.current = active;
    }
    focusPendingRef.current = true;
  }, [started]);
  useEffect(() => {
    if (!focusPendingRef.current || !layout.card || layout.hidden) return;
    focusPendingRef.current = false;
    document.getElementById(nextId)?.focus();
  }, [layout, started, nextId]);

  if (mode.kind === "closed") return null;

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (mode.kind === "open" && e.key === "ArrowRight") {
      if (mode.step < WALKTHROUGH_STEPS.length - 1) goTo(mode.step + 1);
    } else if (mode.kind === "open" && e.key === "ArrowLeft") {
      if (mode.step > 0) goTo(mode.step - 1);
    }
  };

  const card = layout.card;
  const step = mode.kind === "open" ? WALKTHROUGH_STEPS[mode.step] : null;
  const last = mode.kind === "open" && mode.step === WALKTHROUGH_STEPS.length - 1;
  // Only where showPopover exists: an engine that styles [popover] hidden
  // but cannot show it would hide the card for good.
  const popover = typeof HTMLElement.prototype.showPopover === "function";

  return (
    <div
      ref={rootRef}
      popover={popover ? "manual" : undefined}
      // The layer itself is an empty point; the ring and the card place
      // themselves against the viewport.
      className="fixed left-0 top-0 z-[60] m-0 h-0 w-0 overflow-visible border-0 bg-transparent p-0"
    >
      {layout.ring && !layout.hidden && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[var(--radius-action)] border-2 border-[var(--cyan)]"
          style={layout.ring}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        className="fixed flex flex-col rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-panel)] font-sans text-[var(--text-primary)] [box-shadow:var(--shadow-overlay)]"
        style={{
          top: card?.top ?? 8,
          left: card?.left ?? 8,
          width: card?.width ?? CARD_WIDTH,
          maxHeight: card?.maxHeight ?? undefined,
          visibility: layout.hidden || !card ? "hidden" : undefined,
        }}
      >
        {step && (
          <button
            type="button"
            onClick={close}
            aria-label="close the walkthrough"
            className="touch-target absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
        <div
          ref={textRef}
          aria-live="polite"
          className={`min-h-0 flex-1 overflow-y-auto pl-3 ${layout.compact ? "pt-2" : "pt-3"} ${step ? "pr-11" : "pr-3"}`}
        >
          <h2 id={titleId} className="font-sans text-[15px] font-medium leading-snug">
            {step ? step.title : "New to the playground?"}
          </h2>
          {/* Over a phone's top bar there is room for the title and the two
              buttons only; the sentence stays for a screen reader. */}
          <p
            id={bodyId}
            className={layout.compact ? "sr-only" : "mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]"}
          >
            {step
              ? step.body
              : "A short walkthrough points at each part of the screen in turn, from the editor to the run controls, the registers, and the tools. You can leave it at any step and pick it up again from tutorials."}
            {step && layout.hint && (
              <span className="text-[var(--text-primary)]"> {layout.hint}</span>
            )}
          </p>
        </div>
        <div className={`flex shrink-0 items-center gap-2 ${layout.compact ? "px-3 pb-2 pt-1" : "p-3"}`}>
          {step ? (
            <>
              <Button
                variant="secondary"
                onClick={() => goTo(mode.kind === "open" ? mode.step - 1 : 0)}
                disabled={mode.kind === "open" && mode.step === 0}
                className="!min-h-[36px] !px-3 !text-[13px] [@media(pointer:coarse)]:!min-h-[44px]"
              >
                back
              </Button>
              <span className="flex-1 text-center font-mono text-[12px] text-[var(--text-tertiary)]">
                {mode.kind === "open" ? mode.step + 1 : 0} of {WALKTHROUGH_STEPS.length}
              </span>
              <Button
                id={nextId}
                onClick={() => (last ? finish() : goTo(mode.kind === "open" ? mode.step + 1 : 0))}
                className="!min-h-[36px] !px-3 !text-[13px] [@media(pointer:coarse)]:!min-h-[44px]"
              >
                {last ? "done" : "next"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={close}
                className="!min-h-[36px] !px-3 !text-[13px] [@media(pointer:coarse)]:!min-h-[44px]"
              >
                not now
              </Button>
              <div className="flex-1" />
              <Button
                onClick={() => goTo(loadProgress().step)}
                className="!min-h-[36px] !px-3 !text-[13px] [@media(pointer:coarse)]:!min-h-[44px]"
              >
                start the walkthrough
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
