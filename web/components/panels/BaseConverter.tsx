"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  WIDTHS,
  type Rep,
  type Width,
  bitAt,
  fitsUnsigned,
  flipBit,
  formatHex,
  formatRep,
  parseRep,
  signBit,
  truncate,
} from "@/lib/asm/base-convert";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const STORE_KEY = "aarch64-playground:base-converter";

// The value and width survive tab switches and page moves the same way
// watches do: the student converts mid-step, checks memory, and comes back.
function loadInitial(): { width: Width; bits: bigint } {
  const fallback = { width: 32 as Width, bits: 0n };
  const raw = safeGetItem(STORE_KEY);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const width = WIDTHS.find((w) => w === (parsed as { width?: unknown }).width);
    const hex = (parsed as { hex?: unknown }).hex;
    if (!width || typeof hex !== "string") return fallback;
    const outcome = parseRep("hex", hex, width);
    if (outcome.kind !== "ok") return fallback;
    return { width, bits: outcome.bits };
  } catch {
    return fallback;
  }
}

const FIELDS: Array<{ rep: Rep; label: string; prefix?: string }> = [
  { rep: "hex", label: "hex", prefix: "0x" },
  { rep: "binary", label: "binary" },
  { rep: "unsigned", label: "unsigned" },
  { rep: "signed", label: "signed (two's complement)" },
];

// Register names the course maps widths onto; the title makes 32/64 read
// as w and x without widening the buttons.
const WIDTH_TITLES: Record<Width, string> = {
  8: "byte",
  16: "halfword",
  32: "word, a w register",
  64: "doubleword, an x register",
};

const HINT = "type in any field, or click a bit to flip it";

/**
 * Hex, binary, decimal, and two's complement, kept in sync as the user types
 * into any of them. The canonical value is the bit pattern (lib/base-convert);
 * a field being typed in keeps the user's raw text until blur, and input the
 * width cannot hold gets an inline message while the last good value stands.
 * Everything here is the user acting, so the accents are cyan; the one amber
 * mark is the sign-bit cap, which is the machine's reading of the pattern,
 * not something the user pressed.
 */
export function BaseConverter({ className = "" }: { className?: string }) {
  const uid = useId();
  // Two reads of one blob: each initializer takes the field it owns.
  const [width, setWidth] = useState<Width>(() => loadInitial().width);
  const [bits, setBits] = useState<bigint>(() => loadInitial().bits);
  const [draft, setDraft] = useState<{ rep: Rep; text: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [focusBit, setFocusBit] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // storage full or blocked: the widget still works, it just won't persist
    safeSetItem(STORE_KEY, JSON.stringify({ width, hex: formatHex(bits, width) }));
  }, [bits, width]);

  const onFieldChange = useCallback(
    (rep: Rep, text: string) => {
      setDraft({ rep, text });
      const outcome = parseRep(rep, text, width);
      if (outcome.kind === "ok") {
        setBits(outcome.bits);
        setMessage(null);
      } else if (outcome.kind === "empty") {
        // A cleared field is just mid-edit; the last value stands quietly.
        setMessage(null);
      } else {
        setMessage(outcome.message);
      }
    },
    [width],
  );

  // Leaving a field snaps it back to the canonical formatting, so any
  // held-input message is resolved and clears with it.
  const onFieldBlur = useCallback(() => {
    setDraft(null);
    setMessage(null);
  }, []);

  const onWidthChange = useCallback(
    (next: Width) => {
      if (next === width) return;
      setDraft(null);
      if (!fitsUnsigned(bits, next)) {
        setBits(truncate(bits, next));
        setMessage(`didn't fit in ${next} bits; kept the low ${next}`);
      } else {
        setMessage(null);
      }
      setFocusBit((f) => (f === null ? null : Math.min(f, next - 1)));
      setWidth(next);
    },
    [bits, width],
  );

  const onBitClick = useCallback(
    (index: number) => {
      setBits((b) => flipBit(b, index, width));
      setDraft(null);
      setMessage(null);
      setFocusBit(index);
    },
    [width],
  );

  // Roving tabindex over the bit grid: one tab stop, arrows walk the bits,
  // Home/End jump to the sign bit and bit 0, Enter/Space flip (native button).
  const tabbableBit = Math.min(focusBit ?? width - 1, width - 1);
  const moveFocus = useCallback((next: number) => {
    setFocusBit(next);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-bit="${next}"]`)
      ?.focus();
  }, []);

  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveFocus(Math.min(tabbableBit + 1, width - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveFocus(Math.max(tabbableBit - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        moveFocus(width - 1);
      } else if (e.key === "End") {
        e.preventDefault();
        moveFocus(0);
      }
    },
    [moveFocus, tabbableBit, width],
  );

  const hexChars = formatHex(bits, width);
  const nibbles = Array.from({ length: width / 4 }, (_, g) => ({
    // Nibble 0 is the most significant; its bits run MSB-first left to right.
    indices: [3, 2, 1, 0].map((k) => width - 4 * (g + 1) + k),
    hexDigit: hexChars[g],
  }));
  const sign = signBit(bits, width);

  return (
    <div className={`p-3 text-xs flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
          base converter
        </h2>
        <div role="group" aria-label="bit width" className="inline-flex items-center gap-1">
          {WIDTHS.map((w) => {
            const active = w === width;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={active}
                aria-label={`${w} bits, ${WIDTH_TITLES[w]}`}
                title={WIDTH_TITLES[w]}
                onClick={() => onWidthChange(w)}
                className={`inline-flex items-center justify-center rounded-[var(--radius-control)] min-h-[32px] px-2 font-mono text-[12px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                  active
                    ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                }`}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={gridRef}
        role="group"
        aria-label={`bit pattern, ${width} bits; arrow keys move, enter or space flips`}
        onKeyDown={onGridKeyDown}
        className="flex flex-wrap gap-x-2 gap-y-2"
      >
        {nibbles.map((nibble) => (
          <span key={nibble.indices[0]} className="flex flex-col items-center gap-0.5">
            <span className="flex gap-px">
              {nibble.indices.map((i) => {
                const isSign = i === width - 1;
                const on = bitAt(bits, i) === 1;
                return (
                  <button
                    key={i}
                    type="button"
                    data-bit={i}
                    tabIndex={i === tabbableBit ? 0 : -1}
                    aria-pressed={on}
                    aria-label={isSign ? `sign bit ${i}` : `bit ${i}`}
                    title={isSign ? `sign bit ${i}` : `bit ${i}`}
                    onClick={() => onBitClick(i)}
                    onFocus={() => setFocusBit(i)}
                    className={`h-6 w-5 rounded-sm border font-mono text-[11px] leading-none transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                      on
                        ? "border-[var(--cyan)] bg-[var(--bg-elevated)] font-semibold text-[var(--cyan)]"
                        : "border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:border-[var(--cyan-dim)]"
                    } ${isSign ? "border-t-2 border-t-[var(--amber)]" : ""}`}
                  >
                    {on ? 1 : 0}
                  </button>
                );
              })}
            </span>
            {/* The hex digit under each nibble: pack four bits, read one digit,
                the by-hand procedure the exams ask for. */}
            <span aria-hidden="true" className="font-mono text-[10px] text-[var(--text-tertiary)]">
              {nibble.hexDigit}
            </span>
          </span>
        ))}
      </div>

      <p className="font-mono text-[11px]">
        <span className={sign === 1 ? "text-[var(--amber)]" : "text-[var(--text-secondary)]"}>
          sign bit {sign}
        </span>
        <span className="text-[var(--text-secondary)]">
          {sign === 1
            ? " · the signed reading goes negative"
            : " · signed and unsigned read the same"}
        </span>
      </p>

      <div className="flex flex-col gap-1.5">
        {FIELDS.map(({ rep, label, prefix }) => {
          const id = `${uid}-${rep}`;
          const text = draft?.rep === rep ? draft.text : formatRep(rep, bits, width);
          return (
            <div key={rep} className="flex flex-col gap-0.5">
              <label
                htmlFor={id}
                className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]"
              >
                {label}
              </label>
              <div className="flex items-center gap-1">
                {prefix && (
                  <span aria-hidden="true" className="font-mono text-[11px] text-[var(--text-tertiary)]">
                    {prefix}
                  </span>
                )}
                <input
                  id={id}
                  type="text"
                  value={text}
                  onChange={(e) => onFieldChange(rep, e.target.value)}
                  onBlur={onFieldBlur}
                  spellCheck={false}
                  autoComplete="off"
                  aria-describedby={message ? `${uid}-message` : undefined}
                  className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-raised)] px-2 py-1 font-mono text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
                />
              </div>
            </div>
          );
        })}
      </div>

      <p
        id={`${uid}-message`}
        role="status"
        className={`min-h-[1.25em] font-mono text-[11px] ${
          message ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"
        }`}
      >
        {message ?? HINT}
      </p>
    </div>
  );
}
