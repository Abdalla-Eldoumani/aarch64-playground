/**
 * The words for the playground's own frame check. The crate hands over each
 * finding as numbers and the program's names (a FrameCheckRow after the
 * lint's own warnings); only the editor imports this, so the words ship in
 * its lazy chunk and never in a page's first load.
 */
import type { AssemblyError, FrameCheckRow, LintWarning } from "@/lib/emulator/emulator-state";

// The rules as the crate numbers them (emulator/src/frames/check.rs).
const OVERLAP = 0;
const OUTSIDE = 1;
const ON_RECORD = 2;
const UNALIGNED = 3;
const ODD_FRAME = 4;

const LABEL = "frame check: ";
const NOT_GAS = " (The playground checks this; gcc on the server does not.)";

/** Every lint row as a warning the editor shows. A frame size the lint
 *  already flags on the same line is left to the lint. */
export function wordLint(rows: readonly LintWarning[]): AssemblyError[] {
  const linted = new Set(rows.flatMap((row) => ("message" in row ? [row.line] : [])));
  return rows.flatMap((row) => {
    if ("message" in row) return [row];
    if (row.check[0] === ODD_FRAME && linted.has(row.line)) return [];
    return [{ line: row.line, message: LABEL + frameCheckText(row) + NOT_GAS }];
  });
}

function frameCheckText({ check, names }: FrameCheckRow): string {
  const [rule, frame, offset, width, offset2, width2] = check;
  const [fn, name, name2] = names;
  const owner = fn ? `${fn}'s` : "this function's";
  const slot = (n: string, at: number, w: number) => `${n} (${w} bytes at ${at} to ${at + w - 1})`;
  const end = offset + width;
  switch (rule) {
    case OVERLAP:
      return `${slot(name, offset, width)} and ${slot(name2, offset2, width2)} overlap in ${owner} frame, so storing one changes the other. Give each its own bytes.`;
    case OUTSIDE:
      return offset < 0
        ? `${slot(name, offset, width)} starts below fp, outside ${owner} ${frame}-byte frame (bytes 0 to ${frame - 1}). Locals go at 16 or above.`
        : `${slot(name, offset, width)} runs past the end of ${owner} ${frame}-byte frame (bytes 0 to ${frame - 1}). Make alloc cover it, or move it down.`;
    case ON_RECORD: {
      const saved = offset < 8 && end > 8 ? "fp and lr (bytes 0 to 15)" : offset < 8 ? "fp (bytes 0 to 7)" : "lr (bytes 8 to 15)";
      return `${slot(name, offset, width)} sits on the saved ${saved}, which ${fn || "the function"} needs to return. Locals start at 16, above the saved fp and lr.`;
    }
    case UNALIGNED:
      return `${name} holds 8 bytes at ${offset}, which is not a multiple of 8. Move it to a multiple of 8, such as ${Math.max(16, Math.ceil(offset / 8) * 8)}.`;
    default:
      return `${owner} frame is ${frame} bytes, which leaves sp off a multiple of 16. Round it up to ${Math.ceil(frame / 16) * 16}, as alloc = -(16 + locals) & -16 does.`;
  }
}
