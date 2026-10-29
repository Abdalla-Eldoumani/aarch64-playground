"use client";

import { useId } from "react";
import type { CallRow, DrawnCalls } from "@/lib/emulator/call-tree";

// The call the machine is in carries the amber bar the machine's marks use
// (the frames view's write, the editor's current line); a call waiting on
// its callee reads in full ink, and a finished one is dimmed with its value.
const STATE_STYLE: Record<CallRow["state"], string> = {
  current: "font-medium text-[var(--text-primary)] [box-shadow:inset_3px_0_0_0_var(--amber)]",
  running: "text-[var(--text-primary)]",
  returned: "text-[var(--text-tertiary)]",
};
const STATE_SAID: Record<CallRow["state"], string> = {
  current: ", the current call",
  running: ", waiting for its call to return",
  returned: "",
};

function Rows({ rows }: { rows: CallRow[] }) {
  return rows.map((row, i) => (
    <li key={i}>
      <p className={`py-px pl-2 text-[13px] leading-snug ${STATE_STYLE[row.state]}`}>
        <span aria-hidden="true">{row.call}</span>
        <span className="sr-only">{row.said}</span>
        {row.result && ` · ${row.result}`}
        <span className="sr-only">{STATE_SAID[row.state]}</span>
      </p>
      {row.children.length > 0 && (
        <ol className="pl-3">
          <Rows rows={row.children} />
        </ol>
      )}
    </li>
  ));
}

/** The calls made so far, main first, each call's own calls nested under
 *  it in the order it made them. Nothing moves while a program runs or
 *  steps: a call is a new row, a return dims its row. */
export function CallTree({ calls }: { calls: DrawnCalls }) {
  const label = useId();
  return (
    <div className="mb-3">
      <p id={label} className="mb-1 text-[12px] text-[var(--text-secondary)]">
        calls so far
      </p>
      <ol aria-labelledby={label}>
        <Rows rows={calls.rows} />
      </ol>
      {calls.hidden && <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{calls.hidden}</p>}
    </div>
  );
}
