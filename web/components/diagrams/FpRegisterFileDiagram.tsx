import type { JSX } from "react";

/**
 * Static role map of the 32 vector registers. Each cell is one 128-bit
 * register drawn as two halves, bits 127:64 on the left and bits 63:0 (the d
 * view) on the right; only the halves a call keeps are solid, so v8-v15
 * visibly keep their low half and nothing else. The tints follow AapcsRail:
 * cyan for arguments, amber for callee-saved.
 */

type FpFamily = "args" | "callee" | "caller";

interface FpRoleGroup {
  role: string;
  family: FpFamily;
  first: number;
  last: number;
}

const GROUPS: FpRoleGroup[] = [
  { role: "arguments & result", family: "args", first: 0, last: 7 },
  { role: "callee-saved, low 64 bits only", family: "callee", first: 8, last: 15 },
  { role: "caller-saved temporaries", family: "caller", first: 16, last: 31 },
];

/** Saved-ness -> token. color-mix tints keep the fills theme-following. */
const FAMILY_TINT: Record<FpFamily, string> = {
  args: "var(--cyan)",
  callee: "var(--amber)",
  caller: "var(--border-strong)",
};

const LEGEND: { family: FpFamily; label: string }[] = [
  { family: "args", label: "arguments & result (v0-v7)" },
  { family: "callee", label: "callee-saved, bits 63:0 only (v8-v15)" },
  { family: "caller", label: "caller-saved temporaries (v16-v31)" },
];

// A half the call keeps: solid amber. A half it may change: a dashed outline
// in tertiary ink, which keeps 3:1 against the card in every theme.
const KEPT =
  "h-2 rounded-[var(--radius-control)] border border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_45%,transparent)]";
const LOST = "h-2 rounded-[var(--radius-control)] border border-dashed border-[var(--text-tertiary)]";

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export function FpRegisterFileDiagram({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="aapcs64 vector register file"
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map((item) => (
          <li
            key={item.family}
            className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-[var(--border-strong)]"
              style={{
                backgroundColor: `color-mix(in srgb, ${FAMILY_TINT[item.family]} 35%, transparent)`,
              }}
            />
            {item.label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          <span aria-hidden="true" className={`inline-block w-5 ${KEPT}`} />
          kept across a call
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          <span aria-hidden="true" className={`inline-block w-5 ${LOST}`} />
          a call may change it
        </li>
      </ul>

      <div className="flex flex-col gap-3">
        {GROUPS.map((group) => (
          <div key={group.role} className="flex flex-col gap-1.5">
            <h3 className="text-[12px] uppercase tracking-wider text-[var(--text-secondary)]">
              {group.role}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {range(group.first, group.last).map((n) => {
                const keepsLow = group.family === "callee";
                // 3.25rem cells with px-2 fit four to a row on a 320px phone.
                return (
                  <li
                    key={n}
                    aria-label={
                      keepsLow
                        ? `v${n}: bits 63:0, d${n}, kept across a call; bits 127:64 may change`
                        : `v${n}: a call may change all 128 bits`
                    }
                    className="flex min-h-[44px] min-w-[3.25rem] flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] border-t-[3px] px-2 py-2"
                    style={{
                      borderTopColor: FAMILY_TINT[group.family],
                      backgroundColor: `color-mix(in srgb, ${FAMILY_TINT[group.family]} 8%, transparent)`,
                    }}
                  >
                    <span className="font-mono text-[13px] text-[var(--text-primary)]">
                      v{n}
                    </span>
                    <span aria-hidden="true" className="grid w-full grid-cols-2 gap-[2px]">
                      <span className={LOST} />
                      <span className={keepsLow ? KEPT : LOST} />
                    </span>
                    <span className="font-mono text-[12px] text-[var(--text-secondary)]">
                      d{n}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-[var(--text-secondary)]">
        {"Each cell is one 128-bit register: the left half of its bar is bits 127:64 and the right half is bits 63:0, the "}
        <span className="font-mono text-[var(--text-primary)]">dN</span>
        {" view the course uses, whose low 32 bits are "}
        <span className="font-mono text-[var(--text-primary)]">sN</span>
        {". A call keeps only the solid halves, "}
        <span className="font-mono text-[var(--text-primary)]">d8</span>
        {" to "}
        <span className="font-mono text-[var(--text-primary)]">d15</span>
        {". There is no floating-point frame pointer."}
      </p>
    </section>
  );
}
