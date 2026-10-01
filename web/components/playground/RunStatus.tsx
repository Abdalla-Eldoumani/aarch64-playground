"use client";

import { compactHex } from "@/lib/emulator/register-format";
import { formatSteps } from "@/lib/emulator/format-steps";

export interface RunStatusProps {
  programLoaded: boolean;
  isRunning: boolean;
  isHalted: boolean;
  blocked: boolean;
  exitCode: number | null;
  stepCount: number;
  /** The machine or the assembler reported an error. */
  failed: boolean;
  /** x0-x30 as the hub's `0x...` text. */
  registers: string[];
  sp: string;
  /** Indices the last step wrote: 0-30 are x0-x30, 31 is sp. */
  changedRegs: ReadonlySet<number>;
  /** Show what the last step wrote, for a layout where the register file is
   *  not on screen. */
  showPeek: boolean;
  onOpenRegisters: () => void;
}

/** What the machine is doing, in the few words a phone line has room for. */
function statusText(p: RunStatusProps): string {
  if (p.failed) return "stopped on an error";
  if (p.blocked) return "waiting for input";
  if (p.isRunning) return "running";
  const steps = formatSteps(p.stepCount);
  if (p.isHalted) return p.exitCode == null ? `finished · ${steps}` : `finished · exit ${p.exitCode} · ${steps}`;
  if (!p.programLoaded) return "not assembled";
  return p.stepCount > 0 ? steps : "ready to step";
}

/**
 * On a phone the registers sit on their own tab, so this line shows the last
 * step's writes under the code and is the only sign there that a run finished.
 */
export function RunStatus(props: RunStatusProps) {
  const { programLoaded, registers, sp, changedRegs, showPeek, onOpenRegisters } = props;
  const writes = [...changedRegs]
    .sort((a, b) => a - b)
    .map((i) => ({
      name: i === 31 ? "sp" : `x${i}`,
      value: compactHex(i === 31 ? sp : (registers[i] ?? "0")),
    }));
  const spoken = writes.length
    ? writes.map((w) => `${w.name} = ${w.value}`).join(", ")
    : "nothing written";
  const text = statusText(props);
  const tone = props.failed
    ? "text-[var(--danger)]"
    : props.blocked
      ? "text-[var(--cyan)]"
      : "text-[var(--text-secondary)]";

  return (
    <div className="flex min-h-[44px] items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-sunken)] pl-1 pr-3">
      {showPeek && programLoaded ? (
        <button
          type="button"
          onClick={onOpenRegisters}
          aria-label={props.isRunning ? "open the registers" : `last step wrote ${spoken}. open the registers`}
          className="flex h-11 min-w-[44px] flex-1 items-center gap-1.5 overflow-hidden rounded-[var(--radius-control)] px-2 text-left focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          {props.isRunning || writes.length === 0 ? (
            // A run streams snapshots; chips that change many times a second
            // say nothing, so the peek holds still until it stops.
            <span className="font-sans text-[12px] text-[var(--text-tertiary)]">
              {props.isRunning ? "registers" : "no register written"}
            </span>
          ) : (
            writes.map((w) => (
              <span
                key={w.name}
                className="shrink-0 rounded-[3px] border border-[var(--border)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text-primary)]"
              >
                <span className="text-[var(--amber)]">{w.name}</span> {w.value}
              </span>
            ))
          )}
        </button>
      ) : (
        <span className="flex-1" />
      )}
      <p role="status" className={`shrink-0 font-mono text-[12px] ${tone}`}>
        {text}
      </p>
    </div>
  );
}
