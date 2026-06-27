"use client";

import type { DecodedInstruction } from "@/lib/use-emulator";

interface InstructionViewProps {
  instructions: DecodedInstruction[];
  pc: number;
  /** When the program is running, the current-instruction row breathes its
   *  amber PC marker. Default off; the page wires `running={emu.isRunning}`
   *  during the composition pass. */
  running?: boolean;
}

export function InstructionView({
  instructions,
  pc,
  running = false,
}: InstructionViewProps) {
  if (instructions.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--text-secondary)]">
        no program assembled
      </div>
    );
  }

  return (
    <div className="p-3 text-xs">
      <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px] mb-2">
        disassembly
      </h2>
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
          {instructions.map((instr) => {
            const isCurrent = instr.address === pc;
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
                  0x{instr.address.toString(16).padStart(8, "0")}
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
