"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EmulatorState } from "@/lib/emulator/emulator-state";
import { formatWord32 } from "@/lib/emulator/format-hex";
import { calleeCards, plain, returnCard, writeCards, writtenSlots, type Card } from "@/lib/emulator/frame-cards";
import {
  decodeFrameLayout,
  decodeFrames,
  drawFrames,
  rangesToRead,
  wordAt,
  type BoxKind,
  type StackBytes,
} from "@/lib/emulator/stack-frames";

type FramesViewProps = Pick<
  EmulatorState,
  | "frames"
  | "frameLayout"
  | "registers"
  | "sp"
  | "pc"
  | "getMemory"
  | "dirtyAddrs"
  | "memoryRegions"
  | "lineLabel"
  | "programLoaded"
> &
  Partial<Pick<EmulatorState, "programLines" | "noteRows" | "readMemory" | "errorCard">> & { running: boolean };

// The cards' inputs before a program has run: an embed's idle stack side.
const NO_LINES: EmulatorState["programLines"] = { linePlace: () => null, lineAddr: () => null };
const NO_ROWS: number[] = [];

// The card events said, per program load, outside any one view, so a view
// mounted again (the memory tab and back, a phone's chip press) or Back onto
// a step says none of them twice. Every assemble hands the view a new layout
// object, so a reset, an edit or a run from the start, each of which
// assembles again, starts a new set.
const saidPerLoad = new WeakMap<object, Set<string>>();

// Saved registers sit on a raised surface in the approved look's purple (the
// number ink: the register ink is pink in the dark themes and read as the
// danger red beside it), locals on a faint success tint, and the gaps are
// dashed outlines; a changed saved register takes the danger style instead.
// Every tint mixes over --bg-base, so its text contrast is the one the theme
// tests hold for 15% fills.
const KIND_STYLE: Record<BoxKind, string> = {
  saved: "border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--syntax-number)]",
  local: "border border-[var(--border)] bg-[color-mix(in_srgb,var(--success)_10%,var(--bg-base))] text-[var(--success)]",
  padding: "border border-dashed border-[var(--border-strong)] text-[var(--text-secondary)]",
  reserved: "border border-dashed border-[var(--border-strong)] text-[var(--text-secondary)]",
};
const OVERWRITTEN =
  "border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-base))] text-[var(--danger)]";

/**
 * Each call's frame as the course draws it, main first and the innermost
 * call last: offsets from fp on the left, a box per saved register, local
 * and gap, and where sp and fp point on the right. The last step's write
 * carries the amber bar. Nothing moves while a program steps: growth is new
 * boxes, the markers moving, and the bar.
 */
export function FramesView({
  frames,
  frameLayout,
  registers,
  sp,
  pc,
  getMemory,
  dirtyAddrs,
  memoryRegions,
  lineLabel,
  programLines = NO_LINES,
  noteRows = NO_ROWS,
  readMemory,
  errorCard = null,
  programLoaded,
  running,
}: FramesViewProps) {
  const snapshot = useMemo(() => (frames ? decodeFrames(frames) : null), [frames]);
  const layout = useMemo(() => (frameLayout ? decodeFrameLayout(frameLayout) : null), [frameLayout]);
  const spValue = parseInt(sp, 16) || 0;
  const fpValue = parseInt(registers[29] ?? "", 16) || 0;
  const memory = snapshot ? rangesToRead(snapshot).map(([addr, len]) => ({ addr, bytes: getMemory(addr, len) })) : [];
  const stack = snapshot
    ? drawFrames({
        snapshot,
        layout,
        sp: spValue,
        fp: fpValue,
        pc,
        memory,
        written: dirtyAddrs,
        regions: memoryRegions,
        lineLabel,
      })
    : null;
  // A write card quotes the slot's new word as the machine holds it: the
  // bytes above come from the panel cache, which answers zeros until its own
  // read lands, and a card worded from those was painted and said twice.
  const [slotWords, setSlotWords] = useState<{ frames: readonly number[]; bytes: StackBytes[] } | null>(null);
  useEffect(() => {
    const slots = snapshot ? writtenSlots(snapshot) : [];
    if (!frames || !readMemory || slots.length === 0) return;
    let live = true;
    Promise.all(slots.map(({ addr }) => readMemory(addr, 8))).then(
      (read) => {
        if (live) setSlotWords({ frames, bytes: slots.map(({ addr }, i) => ({ addr, bytes: read[i] })) });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [frames, snapshot, readMemory]);
  const written = slotWords?.frames === frames ? slotWords.bytes : [];

  // What went wrong, under the frames: a write over a caller's saved fp or
  // lr at the step that made it, a ret that went to no caller from then on,
  // and a caller reading x19 to x28 a call left changed at the step it read.
  const context = snapshot && { ...programLines, snapshot, layout };
  const ret = context && returnCard(context, BigInt(registers[30] ?? 0));
  const cards: Card[] = context
    ? [
        ...writeCards(context, (addr) => wordAt(written, addr)),
        ...(ret ? [ret] : []),
        ...calleeCards(noteRows, programLines, frameLayout),
      ]
    : [];

  // A call or a return is said once, after the step that made it; a run
  // says nothing, and neither does its stop. Back undoes one step, so it
  // says the call or return it took back; a reset or a new program moves
  // the machine further than that and says nothing.
  const depth = stack?.depth ?? 0;
  const step = snapshot?.step ?? 0;
  const innermost = stack?.frames[stack.frames.length - 1]?.name ?? "";
  const [seen, setSeen] = useState({ depth, innermost, running, step });
  const [said, setSaid] = useState({ text: "", count: 0 });
  if (seen.depth !== depth || seen.running !== running || seen.step !== step) {
    setSeen({ depth, innermost, running, step });
    const back = step === seen.step - 1;
    if (depth !== seen.depth && !running && !seen.running && depth > 0 && seen.depth > 0 && (back || step > seen.step)) {
      const text =
        depth > seen.depth
          ? back
            ? `back inside ${innermost}`
            : `${innermost} called`
          : back
            ? `back before the call to ${seen.innermost}`
            : `${seen.innermost} returned`;
      setSaid((prev) => ({ text, count: prev.count + 1 }));
    }
  }
  // A card is said once per program load, without the backticks that mark
  // its code, when its event first shows at a stop: after a step, and when a
  // run stops however it stopped (a breakpoint, a goal, a pause, a fault);
  // never while a run goes, and not when the run row's alert carries the
  // same card. Its event counts as said either way, once the stop renders.
  const cardKey = cards.map((card) => card.event).join("\n");
  const [mountKey] = useState(() => ({}));
  const loadKey = frameLayout ?? mountKey;
  const unsaid = running ? [] : cards.filter((card) => !saidPerLoad.get(loadKey)?.has(card.event));
  const unsaidKey = unsaid.map((card) => card.event).join("\n");
  const [lastUnsaid, setLastUnsaid] = useState("");
  if (unsaidKey !== lastUnsaid) {
    setLastUnsaid(unsaidKey);
    const spoken = unsaid.filter((card) => card.event !== errorCard?.event);
    if (spoken.length > 0) setSaid((prev) => ({ text: spoken.map(plain).join(" "), count: prev.count + 1 }));
  }
  useEffect(() => {
    if (unsaid.length === 0) return;
    let heard = saidPerLoad.get(loadKey);
    if (!heard) saidPerLoad.set(loadKey, (heard = new Set()));
    for (const card of unsaid) heard.add(card.event);
  });

  // While stepping, what the step wrote stays in view (a write over a
  // caller's frame is the bug to see), with the rest of its call when that
  // fits, else the innermost call: the nearest edge, or the low end, where
  // sp is, of anything taller than the box. The cards come along when they
  // fit beside it, and stay a scroll away when not. Written to this box
  // alone, so the page never scrolls under the reader. A rotation or a
  // resize of the window or the pane brings it back the same way.
  const boxRef = useRef<HTMLDivElement>(null);
  const innermostRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (!box || running) return;
    const span = (targets: HTMLElement[]) => [
      Math.min(...targets.map((t) => t.offsetTop)),
      Math.max(...targets.map((t) => t.offsetTop + t.offsetHeight)),
    ];
    const reveal = () => {
      const wrote = Array.from(box.querySelectorAll<HTMLElement>("[data-wrote]"));
      const calls = wrote.map((w) => w.closest<HTMLElement>("[data-call]") ?? w);
      if (wrote.length === 0 && innermostRef.current) calls.push(innermostRef.current);
      const cards = box.querySelector<HTMLElement>("[data-cards]");
      const anchors = [calls, wrote].filter((t) => t.length > 0);
      const tries = cards ? [...anchors.map((t) => [...t, cards]), ...anchors] : anchors;
      // With no call drawn, the cards alone.
      if (tries.length === 0 && cards) tries.push([cards]);
      if (tries.length === 0) return;
      const spans = tries.map(span);
      const [top, bottom] = spans.find(([t, b]) => b - t <= box.clientHeight) ?? spans[spans.length - 1];
      if (bottom - top > box.clientHeight || bottom > box.scrollTop + box.clientHeight) {
        box.scrollTop = bottom - box.clientHeight;
      } else if (top < box.scrollTop) box.scrollTop = top;
    };
    reveal();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reveal);
    observer.observe(box);
    return () => observer.disconnect();
  }, [frames, cardKey, running]);

  const idle = !programLoaded
    ? "Step through the program to watch each call's frame being built."
    : !stack
      ? "The emulator loaded here cannot draw stack frames."
      : stack.frames.length === 0
        ? "No calls on the stack."
        : null;

  return (
    <div
      ref={boxRef}
      role="group"
      aria-label="stack frames"
      tabIndex={0}
      className="inner-scroll relative h-full overflow-y-auto overscroll-contain p-3 font-sans focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      <p className="mb-2 font-mono text-[12px] text-[var(--text-secondary)]">
        sp {formatWord32(spValue)} · fp {formatWord32(fpValue)}
      </p>
      {idle || !stack ? (
        <p className="text-[13px] text-[var(--text-secondary)]">{idle}</p>
      ) : (
        <ol aria-label="calls, main first">
          {stack.frames.map((frame, i) => (
            <li
              key={frame.index}
              ref={i === stack.frames.length - 1 ? innermostRef : undefined}
              data-call=""
              className="mt-3 first:mt-0"
            >
              <p className="text-[13px]">
                <span className="font-medium text-[var(--text-primary)]">{frame.name}</span>
                <span className="text-[var(--text-secondary)]">
                  {" "}
                  · {frame.bytes} bytes{frame.from && ` · ${frame.from}`}
                </span>
              </p>
              {frame.state && <p className="text-[12px] text-[var(--warning)]">{frame.state}</p>}
              {frame.boxes.length > 0 && (
                <ul aria-label={`${frame.name}'s frame, high address first`} className="mt-1">
                  {/* In the playground's stack tab (a size container) under
                      345px, too short for a 48-byte frame of three locals
                      drawn in full, each box takes one line: the title and
                      the detail side by side. */}
                  {frame.boxes.map((box) => (
                    <li
                      key={box.addr}
                      data-wrote={box.wrote || undefined}
                      className="mt-[3px] grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 [@container(height<345px)]:mt-px"
                    >
                      <span className="text-right font-mono text-[12px] text-[var(--text-tertiary)]">
                        {box.offset}
                      </span>
                      <div
                        className={`px-2 py-[3px] text-[13px] leading-snug [@container(height<345px)]:flex [@container(height<345px)]:flex-wrap [@container(height<345px)]:gap-x-2 [@container(height<345px)]:py-0 [@container(height<345px)]:leading-4 ${
                          box.overwritten ? OVERWRITTEN : KIND_STYLE[box.kind]
                        }`}
                        style={box.wrote ? { boxShadow: "inset 3px 0 0 0 var(--amber)" } : undefined}
                      >
                        <div className="break-words font-medium">{box.title}</div>
                        <div className="break-words text-[12px] text-[var(--text-secondary)]">
                          {box.detail}
                          {box.wrote && <span className="sr-only">, just written</span>}
                        </div>
                      </div>
                      <span className="whitespace-nowrap font-mono text-[12px] text-[var(--text-secondary)]">
                        {box.marker && (
                          <>
                            <span aria-hidden="true">← </span>
                            {box.marker}
                            <span className="sr-only"> points here</span>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {i === 0 && stack.folded && (
                <p className="mt-3 text-[12px] text-[var(--text-secondary)]">{stack.folded}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {stack?.untracked && <p className="mt-3 text-[12px] text-[var(--text-secondary)]">{stack.untracked}</p>}
      {cards.length > 0 && (
        <ul data-cards="" aria-label="what went wrong" className="mt-3">
          {cards.map((card, i) => (
            <li key={i} className="mt-1.5 flex gap-1.5 text-[13px] leading-snug text-[var(--danger)] first:mt-0">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="mt-px h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M8 1.75 15 14.25H1Z" strokeLinejoin="round" />
                <path d="M8 6v4M8 11.75v.5" strokeLinecap="round" />
              </svg>
              {/* Backticks mark an instruction as written. */}
              <span className="min-w-0 break-words">
                {card.text.split("`").map((part, k) => (k % 2 ? <code key={k} className="font-mono text-[12px]">{part}</code> : part))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">
        {said.text}
        {said.count % 2 ? " " : ""}
      </p>
    </div>
  );
}
