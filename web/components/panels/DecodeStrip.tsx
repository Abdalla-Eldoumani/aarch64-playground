"use client";

import { useMemo } from "react";
import { describeLine, extractAliases } from "@/lib/asm/explain-line";
import { decodeFields } from "@/lib/emulator/decode-fields";
import { REGISTER_PATTERN } from "@/lib/asm/highlight-arm64";

const IS_REGISTER = new RegExp(`^${REGISTER_PATTERN}$`, "i");

export interface DecodeStripProps {
  /** Full source text, so the line the CPU is on can be extracted. */
  source: string;
  /** 1-based line of the most recently executed (or about-to-execute) instruction, or null. */
  currentLine: number | null;
  /** The machine word at the program counter, as "0x…" hex, or null before assembly. */
  encodingHex?: string | null;
  /** Compact drops the field row's per-cell meanings (the hero embed header). */
  compact?: boolean;
  /** Set while the pc is inside a libc call, whose code the student did not
   *  write; `waiting` means the call is blocked on a read. */
  externalCall?: { name: string; waiting: boolean } | null;
  /**
   * Whether a program is in the machine. The cold prompt belongs to the
   * empty state only: mid-session, an address the gloss cannot describe gets
   * nothing rather than "step the program", which reads as a broken step.
   */
  sessionStarted?: boolean;
}

/**
 * The instruction under the pc, which is the one the next step runs: its
 * 32-bit encoding cut into labeled fields, and a plain-language line. An unrecognized word stays one box so the strip
 * never invents structure; inside a libc call the word is not the student's
 * code, so a card naming the call replaces both.
 */
export function DecodeStrip({
  source,
  currentLine,
  encodingHex = null,
  compact = false,
  externalCall = null,
  sessionStarted = false,
}: DecodeStripProps) {
  const aliases = useMemo(() => extractAliases(source), [source]);

  const decoded = useMemo(() => {
    if (!encodingHex) return null;
    const word = Number.parseInt(encodingHex, 16);
    if (!Number.isFinite(word)) return null;
    return decodeFields(word);
  }, [encodingHex]);

  // The field row names each register operand under its box, so the line
  // under it leaves out the m4 names that stand for registers: naming them
  // twice wrapped most lines to two at 1024px. The row is an image to a
  // screen reader, so the full line stays in a screen-reader copy.
  const fieldsNameRegisters = !compact && decoded !== null && decoded.fields.length > 1;
  const gloss = useMemo(() => {
    if (currentLine == null) return null;
    const raw = source.split("\n")[currentLine - 1] ?? "";
    const full = describeLine(raw, aliases);
    if (full === null || !fieldsNameRegisters) return full === null ? null : { full, shown: full };
    const constants = Object.fromEntries(Object.entries(aliases).filter(([, value]) => !IS_REGISTER.test(value)));
    return { full, shown: describeLine(raw, constants) ?? full };
  }, [source, currentLine, aliases, fieldsNameRegisters]);

  return (
    <div
      className="w-full flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-raised)]"
      aria-label="next instruction"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono font-medium uppercase tracking-[0.14em] text-[12px] text-[var(--text-secondary)]">
          next instruction
        </span>
        {decoded && encodingHex ? (
          <span className="font-mono text-[12px] text-[var(--text-tertiary)]">
            {encodingHex}
          </span>
        ) : null}
      </div>

      {externalCall ? (
        // The machine is inside the runtime: name the call, say who is
        // running it, and say what happens next. Amber accents because this
        // is the machine acting, kept to the name and the rule so a dense
        // panel does not turn into a warning box.
        <div
          key={`${externalCall.name}-${externalCall.waiting}`}
          className="anim-decode-latch flex flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--amber)] px-2 py-1.5"
          style={{ backgroundColor: "color-mix(in srgb, var(--amber) 8%, transparent)" }}
        >
          <span className="font-mono text-[13px] font-medium text-[var(--amber)]">
            {externalCall.name}
          </span>
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--amber)]">
            external call · handled by the runtime
          </span>
          <span className="font-mono text-[12px] leading-[1.6] text-[var(--text-secondary)] break-words">
            {externalCall.waiting
              ? // The name already leads the card, so the wait line carries
                // only the one fact the student needs: where the input goes.
                "waiting for input in the console"
              : `${externalCall.name} runs inside the interpreter, not in your program; ` +
                "it finishes and returns on a later step"}
          </span>
        </div>
      ) : decoded ? (
        // Keyed by the encoding so each step re-latches the field row.
        <div
          key={`${encodingHex}-${currentLine}`}
          className="flex w-full overflow-x-auto"
          role="img"
          aria-label={`instruction encoding ${encodingHex ?? ""}`}
        >
          {decoded.fields.map((field, index) => {
            const dest = index === decoded.destIndex;
            return (
              // The destination is where this instruction will write, not a
              // register already written: a dashed amber outline, with the
              // value in its usual ink. The register list keeps the solid
              // amber bar and the --changed ink for a write that happened.
              <div
                key={`${field.label}-${index}`}
                className={`anim-decode-latch flex min-w-max flex-col items-center border py-1 ${
                  dest
                    ? "border-dashed border-[var(--amber)] z-10"
                    : "border-[var(--border)]"
                } ${index > 0 ? "-ml-px" : ""}`}
                style={{
                  flexGrow: field.bits,
                  // Floor per field so 1-bit boxes keep their labels legible;
                  // min-w-max above is the harder floor, so a cell can never be
                  // squeezed under its own bit string. The row scrolls
                  // horizontally when the floors overflow.
                  flexBasis: `${Math.max(34, field.bits * 8)}px`,
                }}
              >
                <span
                  className={`px-1 font-mono text-[12px] uppercase tracking-[0.1em] ${
                    dest ? "text-[var(--amber)]" : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {field.label}
                </span>
                <span
                  className={`px-1 font-mono text-[12px] font-medium tabular-nums whitespace-nowrap ${
                    field.kind === "register"
                      ? "text-[var(--syntax-register)]"
                      : field.kind === "immediate"
                        ? "text-[var(--syntax-number)]"
                        : "text-[var(--text-primary)]"
                  }`}
                >
                  {field.value}
                </span>
                {!compact && field.meaning ? (
                  <span
                    className={`px-1 font-mono text-[12px] ${
                      field.kind === "register"
                        ? "text-[var(--syntax-register)]"
                        : "text-[var(--text-tertiary)]"
                    }`}
                  >
                    {field.meaning}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {externalCall ? null : gloss ? (
        // Keyed by the line so each step replays the flash a written register
        // gets. inline-block so the flash measures this box, not the line box.
        <span
          key={currentLine}
          className="anim-reg-flash -mx-1 inline-block rounded-[var(--radius-control)] px-1 font-mono text-[13px] leading-[1.6] text-[var(--text-primary)] break-words"
        >
          {gloss.shown === gloss.full ? (
            gloss.full
          ) : (
            <>
              <span aria-hidden="true">{gloss.shown}</span>
              <span className="sr-only">{gloss.full}</span>
            </>
          )}
        </span>
      ) : sessionStarted ? null : (
        <span className="font-mono text-[13px] leading-[1.6] text-[var(--text-tertiary)]">
          step the program to see the next instruction
        </span>
      )}
    </div>
  );
}
