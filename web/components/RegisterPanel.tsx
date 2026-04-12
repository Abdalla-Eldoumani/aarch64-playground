"use client";

interface RegisterPanelProps {
  registers: string[];
  changedRegs: Set<number>;
  sp: string;
  pc: number;
  nzcv: number;
}

const FLAG_NAMES = ["V", "C", "Z", "N"];

export function RegisterPanel({
  registers,
  changedRegs,
  sp,
  pc,
  nzcv,
}: RegisterPanelProps) {
  const pcHex = "0x" + pc.toString(16).padStart(8, "0");

  return (
    <div className="p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
          registers
        </h2>
        <div className="flex gap-2">
          {FLAG_NAMES.map((name, i) => {
            const bitPos = 3 - i;
            const set = (nzcv >> bitPos) & 1;
            return (
              <span
                key={name}
                className={`px-1 rounded ${
                  set
                    ? "bg-[var(--accent)] text-black font-bold"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {registers.map((val, i) => (
          <RegisterRow
            key={i}
            name={`X${i}`}
            value={val}
            changed={changedRegs.has(i)}
          />
        ))}
        <RegisterRow name="SP" value={sp} changed={changedRegs.has(31)} />
        <RegisterRow name="PC" value={pcHex} changed={false} />
      </div>
    </div>
  );
}

function RegisterRow({
  name,
  value,
  changed,
}: {
  name: string;
  value: string;
  changed: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-0.5 px-1 rounded ${
        changed ? "bg-[var(--changed)] bg-opacity-20 text-[var(--changed)]" : ""
      }`}
    >
      <span className="text-[var(--text-secondary)] w-8">{name}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
