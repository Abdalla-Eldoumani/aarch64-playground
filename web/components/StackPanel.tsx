"use client";

interface StackPanelProps {
  sp: string;
  getMemory: (addr: number, len: number) => Uint8Array;
}

const STACK_BASE = 0x80000000;
const ROWS_TO_SHOW = 16;

export function StackPanel({ sp, getMemory }: StackPanelProps) {
  const spVal = parseInt(sp, 16) || STACK_BASE;
  const bytesToShow = ROWS_TO_SHOW * 8;
  const data = getMemory(spVal, bytesToShow);

  return (
    <div className="p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
          stack
        </span>
        <span className="font-mono text-[var(--accent)]">
          SP = 0x{spVal.toString(16).padStart(16, "0")}
        </span>
      </div>

      <table className="w-full font-mono">
        <thead>
          <tr className="text-[var(--text-secondary)]">
            <th className="text-left">address</th>
            <th className="text-left pl-4">value (u64)</th>
            <th className="text-left pl-4">offset</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS_TO_SHOW }, (_, row) => {
            const addr = spVal + row * 8;
            const offset = row * 8;
            const slice = data.slice(row * 8, (row + 1) * 8);

            // little-endian u64
            let val = BigInt(0);
            for (let i = 7; i >= 0; i--) {
              val = (val << BigInt(8)) | BigInt(slice[i] ?? 0);
            }
            const hex = "0x" + val.toString(16).padStart(16, "0");
            const isZero = val === BigInt(0);

            return (
              <tr
                key={row}
                className={`hover:bg-[var(--bg-secondary)] ${
                  row === 0 ? "text-[var(--accent)]" : ""
                }`}
              >
                <td className="text-[var(--text-secondary)]">
                  0x{addr.toString(16).padStart(8, "0")}
                </td>
                <td
                  className={`pl-4 ${
                    isZero
                      ? "text-[var(--text-secondary)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {hex}
                </td>
                <td className="pl-4 text-[var(--text-secondary)]">
                  SP+{offset}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
