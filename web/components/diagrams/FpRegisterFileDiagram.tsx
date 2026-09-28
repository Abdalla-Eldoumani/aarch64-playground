import type { JSX } from "react";

/**
 * Static floating-point sibling of RegisterFileDiagram. d8-d15 are amber, not
 * green, because the callee-saved promise covers only the low 64 bits. Cells
 * show the course's s/d views; the vector width is left to the footer.
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
        {" is the same register's low 32 bits, the float view: "}
        <span className="font-mono text-[var(--text-primary)]">s0</span>
        {" and "}
        <span className="font-mono text-[var(--text-primary)]">d0</span>
        {" overlap. A float argument travels in "}
        <span className="font-mono text-[var(--text-primary)]">sN</span>
        {", a double in "}
        <span className="font-mono text-[var(--text-primary)]">dN</span>
        {", and "}
        <span className="font-mono text-[var(--text-primary)]">fcvt</span>
        {" converts between them. Whether a call keeps the register is the same in either view. There is no floating-point frame pointer."}
      </p>

      <p className="text-[12px] text-[var(--text-secondary)]">
        {"The same 32 entries are the vector file as well: the playground accepts "}
        <span className="font-mono text-[var(--text-primary)]">q8</span>
        {" and vector forms such as "}
        <span className="font-mono text-[var(--text-primary)]">v8.4s</span>
        {", and the reference's Vector section documents them, while the course keeps to "}
        <span className="font-mono text-[var(--text-primary)]">sN</span>
        {" and "}
        <span className="font-mono text-[var(--text-primary)]">dN</span>
        {". The callee-saved promise is narrower than the register: the calling convention preserves only bits 63:0 of "}
        <span className="font-mono text-[var(--text-primary)]">v8</span>
        {"-"}
        <span className="font-mono text-[var(--text-primary)]">v15</span>
        {", exactly the dN part, so a call may change anything above bit 63."}
      </p>
    </section>
  );
}
