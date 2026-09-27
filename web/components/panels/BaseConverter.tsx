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
import {
  FLOAT_LAYOUT,
  type FloatClass,
  type FloatField,
  type FloatParseOutcome,
  type FloatWidth,
  classify,
  exactValue,
  fieldBinary,
  formatFloatField,
  isFloatWidth,
  parseFloatField,
  powerOfTwoForm,
} from "@/lib/asm/ieee754";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const STORE_KEY = "aarch64-playground:base-converter";

/** A part of the converter a link can open straight to. */
export type ConverterView = "octal" | "ieee754";

// The value and width survive tab switches and page moves the same way
// watches do: the student converts mid-step, checks memory, and comes back.
function loadStored(): { width: Width; bits: bigint } {
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

// A link to the float reading needs a width that has one. Widening
// zero-extends, so the stored pattern survives the move to 32.
function loadInitial(view?: ConverterView): { width: Width; bits: bigint } {
  const stored = loadStored();
  if (view === "ieee754" && !isFloatWidth(stored.width)) return { ...stored, width: 32 };
  return stored;
}

const FIELDS: Array<{ rep: Rep; label: string; prefix?: string }> = [
  { rep: "hex", label: "hex", prefix: "0x" },
  { rep: "octal", label: "octal" },
  { rep: "binary", label: "binary" },
  { rep: "unsigned", label: "unsigned" },
  { rep: "signed", label: "signed (two's complement)" },
];

const FLOAT_FIELDS: Array<{ field: FloatField; label: string; prefix?: string }> = [
  { field: "sign", label: "sign" },
  { field: "exponent", label: "raw exponent" },
  { field: "unbiased", label: "unbiased exponent" },
  { field: "fraction", label: "fraction (hex)", prefix: "0x" },
  { field: "value", label: "value" },
];

// Each class in terms of the fields, so the reading states the rule
// instead of only naming it.
const CLASS_RULE: Record<FloatClass, (bias: number) => string> = {
  zero: () => "raw exponent and fraction all 0; the sign still counts",
  subnormal: (bias) => `raw exponent 0, so 0.fraction × 2^${1 - bias}, no hidden 1`,
  normal: (bias) => `1.fraction × 2^(raw exponent - ${bias})`,
  infinity: () => "raw exponent all 1s, fraction 0",
  "quiet NaN": () => "raw exponent all 1s, top fraction bit 1",
  "signalling NaN": () => "raw exponent all 1s, top fraction bit 0, rest not all 0",
};

// Register names the course maps widths onto; the title makes 32/64 read
// as w and x without widening the buttons.
const WIDTH_TITLES: Record<Width, string> = {
  8: "byte",
  16: "halfword",
  32: "word, a w register",
  64: "doubleword, an x register",
};

const FLOAT_TITLES: Record<FloatWidth, string> = {
  32: "single precision, an s register",
  64: "double precision, a d register",
};

const HINT = "type in any field, or click a bit to flip it";
const EMPTY = "empty; the other fields keep the last value until you type one";

const LABEL = "text-[10px] uppercase tracking-wider text-[var(--text-secondary)]";

interface Message {
  /** The field it belongs to, or "width" for a width switch. */
  key: string;
  text: string;
  /** An error refuses the text; a note accepts it and says how. */
  tone: "error" | "note";
}

/**
 * Hex, octal, binary, decimal, and two's complement, kept in sync as the user
 * types into any of them, plus the IEEE-754 reading at 32 and 64 bits. The
 * canonical value is the bit pattern (lib/asm/base-convert, lib/asm/ieee754);
 * a field being typed in keeps the user's raw text until blur, and text that
 * cannot be a value gets a message right under that field while the last good
 * value stands. Everything here is the user acting, so the accents are cyan;
 * the one amber mark is the sign-bit cap, which is the machine's reading of
 * the pattern, not something the user pressed.
 */
export function BaseConverter({
  className = "",
  view,
}: {
  className?: string;
  /** Open at this part, as a link to it would: scrolled to and focused. */
  view?: ConverterView;
}) {
  const uid = useId();
  // Two reads of one blob: each initializer takes the field it owns.
  const [width, setWidth] = useState<Width>(() => loadInitial(view).width);
  const [bits, setBits] = useState<bigint>(() => loadInitial(view).bits);
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [focusBit, setFocusBit] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // storage full or blocked: the widget still works, it just won't persist
    safeSetItem(STORE_KEY, JSON.stringify({ width, hex: formatHex(bits, width) }));
  }, [bits, width]);

  useEffect(() => {
    // Opened from a link: bring the linked part into view and start the
    // keyboard there, the way following a plain #anchor does.
    const target = viewRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "start" });
  }, []);

  const onFieldChange = useCallback(
    (key: string, text: string, outcome: FloatParseOutcome) => {
      setDraft({ key, text });
      if (outcome.kind === "ok" || outcome.kind === "rounded") setBits(outcome.bits);
      if (outcome.kind === "ok") {
        setMessage(null);
      } else if (outcome.kind === "empty") {
        setMessage({ key, text: EMPTY, tone: "error" });
      } else {
        const tone = outcome.kind === "rounded" ? "note" : "error";
        setMessage({ key, text: outcome.message, tone });
      }
    },
    [],
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
        setMessage({ key: "width", text: `didn't fit in ${next} bits; kept the low ${next}`, tone: "error" });
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

  // One labelled input with its own message line underneath, so a refusal
  // shows where the student is typing even when the panel is taller than
  // the screen. The message line is a live region that is always present
  // (empty when quiet), because a region inserted with its text is often
  // not announced.
  function fieldRow(spec: {
    key: string;
    label: string;
    formatted: string;
    parse: (text: string) => FloatParseOutcome;
    prefix?: string;
  }) {
    const id = `${uid}-${spec.key}`;
    const own = message?.key === spec.key ? message : null;
    const text = draft?.key === spec.key ? draft.text : spec.formatted;
    return (
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className={LABEL}>
          {spec.label}
        </label>
        <div className="flex items-center gap-1">
          {spec.prefix && (
            <span aria-hidden="true" className="font-mono text-[11px] text-[var(--text-tertiary)]">
              {spec.prefix}
            </span>
          )}
          <input
            id={id}
            type="text"
            value={text}
            onChange={(e) => onFieldChange(spec.key, e.target.value, spec.parse(e.target.value))}
            onBlur={onFieldBlur}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-invalid={own?.tone === "error" ? true : undefined}
            aria-describedby={`${id}-message`}
            className={`w-full min-w-0 rounded border bg-[var(--bg-raised)] px-2 py-1 font-mono text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
              own?.tone === "error" ? "border-[var(--warning)]" : "border-[var(--border)]"
            }`}
          />
        </div>
        <p
          id={`${id}-message`}
          role="status"
          className={`font-mono text-[11px] ${
            own?.tone === "error" ? "text-[var(--warning)]" : "text-[var(--text-secondary)]"
          }`}
        >
          {own?.text}
        </p>
      </div>
    );
  }

  function floatReading(w: FloatWidth) {
    const { fractionBits, bias } = FLOAT_LAYOUT[w];
    const parts = fieldBinary(bits, w);
    const kind = classify(bits, w);
    const form = powerOfTwoForm(bits, w);
    const strip = [
      { name: "sign", bits: parts.sign, range: `bit ${w - 1}` },
      { name: "exponent", bits: parts.exponent, range: `bits ${w - 2}-${fractionBits}` },
      { name: "fraction", bits: parts.fraction, range: `bits ${fractionBits - 1}-0` },
    ];
    return (
      <>
        {/* The pattern cut where the hardware cuts it: the same three
            fields the inputs below edit, in binary. */}
        <div className="flex gap-2 font-mono text-[11px]">
          {strip.map((part) => (
            <div
              key={part.name}
              className={`flex flex-col gap-0.5 ${part.name === "fraction" ? "min-w-0 flex-1" : "shrink-0"}`}
            >
              <span className="text-[10px] leading-tight text-[var(--text-secondary)]">
                {part.name}
                <br />
                {part.range}
              </span>
              <span
                className={`flex-1 border border-[var(--border)] bg-[var(--bg-raised)] px-1.5 py-1 text-[var(--text-primary)] ${
                  part.name === "sign" ? "border-t-2 border-t-[var(--amber)]" : ""
                }`}
              >
                {part.bits}
              </span>
            </div>
          ))}
        </div>

        {FLOAT_FIELDS.map(({ field, label, prefix }) => (
          <div key={field}>
            {fieldRow({
              key: `float-${field}`,
              label,
              prefix,
              formatted: formatFloatField(field, bits, w),
              parse: (text) => parseFloatField(field, text, bits, w),
            })}
          </div>
        ))}

        <dl className="flex flex-col gap-1.5 font-mono text-[11px]">
          <div>
            <dt className={LABEL}>class</dt>
            <dd className="text-[var(--text-primary)]">
              {kind}
              <span className="text-[var(--text-secondary)]">: {CLASS_RULE[kind](bias)}</span>
            </dd>
          </div>
          {form && (
            <div>
              <dt className={LABEL}>binary scientific</dt>
              <dd className="break-all text-[var(--text-primary)]">
                {form.significand} × 2^{form.power}
              </dd>
            </div>
          )}
          <div>
            <dt className={LABEL}>exact value</dt>
            <dd className="break-all text-[var(--text-primary)]">{exactValue(bits, w)}</dd>
          </div>
        </dl>
      </>
    );
  }

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
        {FIELDS.map(({ rep, label, prefix }) => (
          <div
            key={rep}
            ref={rep === "octal" && view === "octal" ? viewRef : undefined}
            tabIndex={rep === "octal" && view === "octal" ? -1 : undefined}
            className="scroll-mt-24 focus:outline-none"
          >
            {fieldRow({
              key: rep,
              label,
              prefix,
              formatted: formatRep(rep, bits, width),
              parse: (text) => parseRep(rep, text, width),
            })}
          </div>
        ))}
      </div>

      <p
        role="status"
        className={`min-h-[1.25em] font-mono text-[11px] ${
          message?.key === "width" ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"
        }`}
      >
        {message?.key === "width" ? message.text : HINT}
      </p>

      <div
        ref={view === "ieee754" ? viewRef : undefined}
        tabIndex={view === "ieee754" ? -1 : undefined}
        role="group"
        aria-labelledby={`${uid}-ieee`}
        className="flex scroll-mt-24 flex-col gap-2 border-t border-[var(--border)] pt-3 focus:outline-none"
      >
        <h3 id={`${uid}-ieee`} className={LABEL}>
          IEEE-754 float
          {isFloatWidth(width) && (
            <span className="normal-case tracking-normal">, {FLOAT_TITLES[width]}</span>
          )}
        </h3>
        {isFloatWidth(width) ? (
          floatReading(width)
        ) : (
          <p className="font-mono text-[11px] text-[var(--text-secondary)]">
            pick 32 or 64 bits to read this pattern as a float: 32 is a single (an s
            register), 64 a double (a d register)
          </p>
        )}
      </div>
    </div>
  );
}
