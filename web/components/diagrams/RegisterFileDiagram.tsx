import type { JSX } from "react";

/**
 * Static AAPCS64 register-file teaching diagram: a labeled, role-grouped map of
 * x0-x30 + sp with the fp/lr (and ip0/ip1) aliases. This is presentational only
 * -- it has no runtime, reads no live debugger state, and is deliberately not
 * the interactive register view. The ABI role split mirrors REGISTER_ROLES in
 * LessonMarkdown.tsx exactly (esp. x8 = indirect result, x16/x17 = ip0/ip1,
 * x18 = platform) so the hover-define, this diagram, and the calling-convention
 * guide tell one story. The four color families are saved-ness, read from
 * tokens: cyan = the argument/result area, danger = caller-saved (volatile
 * across a call), success = callee-saved (preserved), and a neutral border
 * tint = the special lr/sp and platform-reserved x18. --amber stays reserved
 * for surfaces where execution is implied, so this static page never spends it.
 */

type Family = "args" | "caller" | "callee" | "special";

interface RegisterCell {
  name: string;
  alias?: string;
}

interface RoleGroup {
  /** Precise ABI role, mirrored from REGISTER_ROLES. */
  role: string;
  family: Family;
  regs: RegisterCell[];
}

function xrange(lo: number, hi: number): RegisterCell[] {
  const cells: RegisterCell[] = [];
  for (let n = lo; n <= hi; n++) cells.push({ name: `x${n}` });
  return cells;
}

const GROUPS: RoleGroup[] = [
  { role: "arguments & return", family: "args", regs: xrange(0, 7) },
  { role: "indirect result / syscall", family: "args", regs: [{ name: "x8" }] },
  { role: "caller-saved temporaries", family: "caller", regs: xrange(9, 15) },
  {
    role: "intra-procedure scratch",
    family: "caller",
    regs: [
      { name: "x16", alias: "ip0" },
      { name: "x17", alias: "ip1" },
    ],
  },
  { role: "platform register (reserved)", family: "special", regs: [{ name: "x18" }] },
  { role: "callee-saved", family: "callee", regs: xrange(19, 28) },
  { role: "frame pointer", family: "callee", regs: [{ name: "x29", alias: "fp" }] },
  { role: "link register", family: "special", regs: [{ name: "x30", alias: "lr" }] },
  { role: "stack pointer", family: "special", regs: [{ name: "sp" }] },
];

/** Saved-ness -> token. color-mix tints keep the fills theme-following. */
const FAMILY_TINT: Record<Family, string> = {
  args: "var(--cyan)",
  caller: "var(--danger)",
  callee: "var(--success)",
  special: "var(--border-strong)",
};

const LEGEND: { family: Family; label: string }[] = [
  { family: "args", label: "arguments, return & indirect result (x0-x8)" },
  { family: "caller", label: "caller-saved, volatile across a call (x9-x17)" },
  { family: "callee", label: "callee-saved, preserved across a call (x19-x29)" },
  { family: "special", label: "platform-reserved x18, link register & stack pointer" },
];

export function RegisterFileDiagram({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="aapcs64 register file"
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
                  className="flex min-h-[44px] min-w-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] border border-[var(--border)] border-t-[3px] px-3 py-2"
                  style={{
                    borderTopColor: FAMILY_TINT[group.family],
                    backgroundColor: `color-mix(in srgb, ${FAMILY_TINT[group.family]} 8%, transparent)`,
                  }}
                >
                  <span className="font-mono text-[13px] text-[var(--text-primary)]">
                    {reg.name}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                    {reg.alias ?? " "}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-[var(--text-secondary)]">
        <span className="font-mono text-[var(--text-primary)]">xzr</span> /{" "}
        <span className="font-mono text-[var(--text-primary)]">wzr</span> is the
        zero register: it reads as zero and discards writes.
      </p>
    </section>
  );
}
