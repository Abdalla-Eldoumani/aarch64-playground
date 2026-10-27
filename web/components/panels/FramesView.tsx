"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EmulatorState } from "@/lib/emulator/emulator-state";
import { formatWord32 } from "@/lib/emulator/format-hex";
import { decodeFrameLayout, decodeFrames } from "@/lib/emulator/frame-data";
import { drawFrames, rangesToRead, type BoxKind } from "@/lib/emulator/stack-frames";

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
> & { running: boolean };

// Saved registers sit on a raised surface in the register ink, locals on a
// faint success tint, and the gaps are dashed outlines; a changed saved
// register takes the danger style instead. Every tint mixes over --bg-base,
// so its text contrast is the one the theme tests hold for 15% fills.
const KIND_STYLE: Record<BoxKind, string> = {
  saved: "border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--syntax-register)]",
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
  programLoaded,
  running,
}: FramesViewProps) {
  const snapshot = useMemo(() => (frames ? decodeFrames(frames) : null), [frames]);
  const layout = useMemo(() => (frameLayout ? decodeFrameLayout(frameLayout) : null), [frameLayout]);
  const spValue = parseInt(sp, 16) || 0;
  const fpValue = parseInt(registers[29] ?? "", 16) || 0;
  const stack = snapshot
    ? drawFrames({
        snapshot,
        layout,
        sp: spValue,
        fp: fpValue,
        pc,
        memory: rangesToRead(snapshot).map(([addr, len]) => ({ addr, bytes: getMemory(addr, len) })),
        written: dirtyAddrs,
        regions: memoryRegions,
        lineLabel,
      })
    : null;

  // A call or a return is said once, after the step that made it; a run
  // says nothing, and neither does its stop.
  const depth = stack?.depth ?? 0;
  const innermost = stack?.frames[stack.frames.length - 1]?.name ?? "";
  const [seen, setSeen] = useState({ depth, innermost, running });
  const [said, setSaid] = useState({ text: "", count: 0 });
  if (seen.depth !== depth || seen.running !== running) {
    setSeen({ depth, innermost, running });
    if (!running && !seen.running && depth > 0 && seen.depth > 0) {
      const text = depth > seen.depth ? `${innermost} called` : `${seen.innermost} returned`;
      setSaid((prev) => ({ text, count: prev.count + 1 }));
    }
  }

  // The innermost frame stays in view while stepping: the nearest edge,
  // written to this box alone so the page never scrolls under the reader.
  const boxRef = useRef<HTMLDivElement>(null);
  const innermostRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    const frame = innermostRef.current;
    if (!box || !frame || running) return;
    const bottom = frame.offsetTop + frame.offsetHeight;
    if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
    else if (frame.offsetTop < box.scrollTop) box.scrollTop = frame.offsetTop;
  }, [frames, running]);

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
                  {frame.boxes.map((box) => (
                    <li
                      key={box.addr}
                      className="mt-[3px] grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-2"
                    >
                      <span className="text-right font-mono text-[12px] text-[var(--text-tertiary)]">
                        {box.offset}
                      </span>
                      <div
                        className={`px-2 py-[3px] text-[13px] leading-snug ${
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
                      <span className="font-mono text-[12px] text-[var(--text-secondary)]">
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
      <p role="status" className="sr-only">
        {said.text}
        {said.count % 2 ? " " : ""}
      </p>
    </div>
  );
}
