// One formatter, built once: toLocaleString builds a new one on every call,
// and the status line calls it on every render of a run. A fixed locale keeps
// the status line, the step-cap error and a pasted report in one form.
const COUNT = new Intl.NumberFormat("en-US");

/** A step count as every surface writes it: "1 step", "1,000,000 steps". */
export function formatSteps(count: number): string {
  return `${COUNT.format(count)} ${count === 1 ? "step" : "steps"}`;
}
