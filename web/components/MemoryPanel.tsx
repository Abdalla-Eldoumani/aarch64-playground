"use client";

import { useCallback, useState } from "react";

interface MemoryPanelProps {
  getMemory: (addr: number, len: number) => Uint8Array;
}

const BYTES_PER_ROW = 16;
const DEFAULT_ROWS = 16;

export function MemoryPanel({ getMemory }: MemoryPanelProps) {
  const [baseAddr, setBaseAddr] = useState("0x00400000");
  const [rows] = useState(DEFAULT_ROWS);

  const addr = parseInt(baseAddr, 16) || 0;
  const totalBytes = rows * BYTES_PER_ROW;
  const data = getMemory(addr, totalBytes);

  const handleAddrChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBaseAddr(e.target.value);
    },
    []
  );

  return (
    <div className="p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
          address
        </label>
        <input
          type="text"
          value={baseAddr}
          onChange={handleAddrChange}
          className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-0.5 text-xs font-mono w-32 text-[var(--text-primary)]"
        />
      </div>

      <table className="w-full font-mono">
        <thead>
          <tr className="text-[var(--text-secondary)]">
            <th className="text-left pr-4">addr</th>
            {Array.from({ length: BYTES_PER_ROW }, (_, i) => (
              <th key={i} className="w-6 text-center">
                {i.toString(16).toUpperCase()}
              </th>
            ))}
            <th className="pl-4 text-left">ascii</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => {
            const rowAddr = addr + row * BYTES_PER_ROW;
            const rowBytes = data.slice(
              row * BYTES_PER_ROW,
              (row + 1) * BYTES_PER_ROW
            );
            return (
              <tr key={row} className="hover:bg-[var(--bg-secondary)]">
                <td className="text-[var(--text-secondary)] pr-4">
                  {formatAddr(rowAddr)}
                </td>
                {Array.from(rowBytes).map((byte, i) => (
                  <td
                    key={i}
                    className={`text-center ${
                      byte !== 0
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {byte.toString(16).padStart(2, "0")}
                  </td>
                ))}
                {/* pad if data is short */}
                {Array.from(
                  { length: BYTES_PER_ROW - rowBytes.length },
                  (_, i) => (
                    <td key={`pad-${i}`} className="text-center text-[var(--text-secondary)]">
                      ..
                    </td>
                  )
                )}
                <td className="pl-4 text-[var(--text-secondary)]">
                  {asciiString(rowBytes)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatAddr(addr: number): string {
  return "0x" + addr.toString(16).padStart(8, "0");
}

function asciiString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
    .join("");
}
