"use client";

import { formatWord32 } from "@/lib/emulator/format-hex";
import type { DecodedInstruction } from "@/lib/emulator/use-emulator";

interface InstructionViewProps {
  instructions: DecodedInstruction[];
  pc: number;
  /** When the program is running, the current-instruction row breathes its
   *  amber PC marker. Default off; the page wires `running={emu.isRunning}`. */
  running?: boolean;
  /**
   * Row to mark and follow instead of the pc. Set to the call site while the
   * pc is inside a hosted libc call: the pc is then a trampoline word or a
   * synthetic stub, so the listing has nothing to mark and the window would
   * park at the top for all three steps. The `bl` row stays marked instead.
   */
  anchorPc?: number | null;
}

/**
 * Rows rendered at once. A 1 MiB .text window allows 262,144 instructions; past
 * this count the view becomes a fixed block that follows the pc, so rows shift
 * only when execution crosses a boundary.
 */
export const INSTRUCTION_WINDOW = 512;

export function InstructionView({
  instructions,
  pc,
  running = false,
  anchorPc = null,
}: InstructionViewProps) {
  // One address drives both the marker and the window.
  const marker = anchorPc ?? pc;
  if (instructions.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--text-secondary)]">
        no program assembled
      </div>
    );
  }

  const windowed = instructions.length > INSTRUCTION_WINDOW;
  let start = 0;
  if (windowed) {
    const pcIndex = instructions.findIndex((instr) => instr.address === marker);
    // A pc outside the listing (a library address, or nothing run yet)
    // parks the window at the top rather than jumping somewhere arbitrary.
    const block = pcIndex < 0 ? 0 : Math.floor(pcIndex / INSTRUCTION_WINDOW);
    start = block * INSTRUCTION_WINDOW;
  }
  const visible = windowed
    ? instructions.slice(start, start + INSTRUCTION_WINDOW)
    : instructions;

  return (
    <div className="p-3 text-xs">
      <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px] mb-2">
        disassembly
      </h2>
      {windowed && (
        <p
          role="status"
          className="mb-2 font-mono text-[10px] text-[var(--text-tertiary)]"
        >
          showing {(start + 1).toLocaleString()}-
          {(start + visible.length).toLocaleString()} of{" "}
          {instructions.length.toLocaleString()} instructions; the window
          follows the program counter
        </p>
      )}
      <table className="w-full font-mono">
        <thead>
          <tr className="text-[var(--text-secondary)]">
            <th className="w-4" />
            <th className="text-left">addr</th>
            <th className="text-left pl-3">encoding</th>
            <th className="text-left pl-3">instruction</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((instr) => {
            const isCurrent = instr.address === marker;
            return (
              <tr
                key={instr.address}
                className={
                  isCurrent
                    ? `text-[var(--amber)]${running ? " anim-run-breathe" : ""}`
                    : "hover:bg-[var(--bg-sunken)]"
                }
                // Current instruction is execution state, so its highlight reads
                // amber; color-mix keeps the tint theme-following across themes.
                style={
                  isCurrent
                    ? {
                        backgroundColor:
                          "color-mix(in srgb, var(--amber) 15%, transparent)",
                      }
                    : undefined
                }
              >
                <td className="text-center">
                  {isCurrent ? "\u25B6" : ""}
                </td>
                <td className="text-[var(--text-secondary)]">
                  {formatWord32(instr.address)}
                </td>
                <td className="pl-3 text-[var(--text-secondary)]">
                  {instr.hex}
                </td>
                <td className="pl-3">{instr.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
