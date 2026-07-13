import type { JSX } from "react";

/**
 * Static AAPCS64 floating-point register-file teaching diagram: d0-d31
 * grouped by ABI role, the floating-point sibling of RegisterFileDiagram.
 * Presentational only -- no runtime, no live debugger state. Each cell
 * names both course views of the register: dN (double, 64 bits) with its
 * sN float view (the low 32 bits) beneath, exactly the s/d pairing the
 * course teaches -- SIMD's extra width stays out of the story. The tints
 * tell the saved-ness story for floats: cyan = the argument/result area
 * (d0-d7, matching the integer diagram's argument band), amber = the
 * callee-must-preserve band d8-d15 (a caution rather than plain
 * success-green: the promise covers the d-sized value, which is all a
 * course double needs), and a neutral border tint = the d16-d31
 * caller-saved temporaries. There is no floating-point frame pointer to
 * mark: x29/x30 stay the frame record, so this strip carries no fp/lr
 * analogue by design.
 */

type FpFamily = "args" | "callee" | "caller";

interface FpCell {
  name: string;
  sview: string;
}

interface FpRoleGroup {
  role: string;
  family: FpFamily;
  regs: FpCell[];
}

function drange(lo: number, hi: number): FpCell[] {
  const cells: FpCell[] = [];
  for (let n = lo; n <= hi; n++) cells.push({ name: `d${n}`, sview: `s${n}` });
  return cells;
}

const GROUPS: FpRoleGroup[] = [
  { role: "arguments & result", family: "args", regs: drange(0, 7) },
  { role: "callee-saved", family: "callee", regs: drange(8, 15) },
  { role: "caller-saved temporaries", family: "caller", regs: drange(16, 31) },
];

/** Saved-ness -> token. color-mix tints keep the fills theme-following. */
const FAMILY_TINT: Record<FpFamily, string> = {
  args: "var(--cyan)",
  callee: "var(--amber)",
  caller: "var(--border-strong)",
};

const LEGEND: { family: FpFamily; label: string }[] = [
  { family: "args", label: "arguments & result (d0-d7 / s0-s7)" },
  { family: "callee", label: "callee-saved (d8-d15)" },
  { family: "caller", label: "caller-saved temporaries (d16-d31)" },
];

export function FpRegisterFileDiagram({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="aapcs64 floating-point register file"
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
      </ul>

      <div className="flex flex-col gap-3">
        {GROUPS.map((group) => (
          <div key={group.role} className="flex flex-col gap-1.5">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              {group.role}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {group.regs.map((reg) => (
                <li
                  key={reg.name}
                  className="flex min-h-[44px] min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] border border-[var(--border)] border-t-[3px] px-3 py-2"
                  style={{
                    borderTopColor: FAMILY_TINT[group.family],
                    backgroundColor: `color-mix(in srgb, ${FAMILY_TINT[group.family]} 8%, transparent)`,
                  }}
                >
                  <span className="font-mono text-[13px] text-[var(--text-primary)]">
                    {reg.name}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                    {reg.sview}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-[var(--text-secondary)]">
        Each register has two views the course uses:{" "}
        <span className="font-mono text-[var(--text-primary)]">dN</span>
        {" is the 64-bit double and "}
        <span className="font-mono text-[var(--text-primary)]">sN</span>
        {" is the same register's low 32 bits, the float view — "}
        <span className="font-mono text-[var(--text-primary)]">s0</span>
        {" and "}
        <span className="font-mono text-[var(--text-primary)]">d0</span>
        {" overlap. A float argument travels in "}
        <span className="font-mono text-[var(--text-primary)]">sN</span>
        {", a double in "}
        <span className="font-mono text-[var(--text-primary)]">dN</span>
        {", and "}
        <span className="font-mono text-[var(--text-primary)]">fcvt</span>
        {" converts between them. The saved-ness role applies to the register whichever view you use. There is no floating-point frame pointer."}
      </p>
    </section>
  );
}
