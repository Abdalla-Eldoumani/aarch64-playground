/**
 * The console note for a register a program read after a library call had
 * overwritten it. The machine reports plain numbers, four per note
 * (`[register, readBy, callLine, readLine]`, from the wasm
 * `take_clobber_notes`), and the words live here, beside the source they
 * take function names from.
 */

/** What read the register: an instruction, a library call taking it as an
 *  argument, or main's return handing it back as the exit status. */
const READ_BY_CALL = 1;
const READ_BY_MAIN_RETURN = 2;

/** "the printf call on line 16", naming the function from the `bl` the
 *  line holds; a line the machine could not map is just "a library call". */
function callOnLine(lines: readonly string[], line: number): string {
  if (line <= 0) return "a library call";
  const callee = /\bbl\s+([A-Za-z_.$][\w.$]*)/.exec(lines[line - 1] ?? "")?.[1];
  return `the ${callee ?? "library"} call on line ${line}`;
}

export function clobberNoteTexts(rows: readonly number[], source: string): string[] {
  const lines = source.split(/\r?\n/);
  const notes: string[] = [];
  for (let i = 0; i + 3 < rows.length; i += 4) {
    const [code, readBy, callLine, readLine] = rows.slice(i, i + 4);
    const isX = code < 32;
    const reg = isX ? `x${code}` : `d${code - 32}`;
    const call = callOnLine(lines, callLine);
    if (readBy === READ_BY_MAIN_RETURN) {
      notes.push(
        `main returns ${reg} as its exit status, but ${call} overwrote it. ` +
          "Set w0 after the last call, for example with mov w0, 0.",
      );
      continue;
    }
    const readingCall = callOnLine(lines, readLine);
    const reader =
      readBy === READ_BY_CALL
        ? `${readingCall[0].toUpperCase()}${readingCall.slice(1)} reads ${reg} as an argument`
        : readLine > 0
          ? `Line ${readLine} reads ${reg}`
          : `The program reads ${reg}`;
    const changed = isX ? "x0 to x18" : "d0 to d7 and d16 to d31";
    const kept = isX ? "x19 to x28" : "d8 to d15";
    const fix =
      readBy === READ_BY_CALL
        ? `Set ${reg} again right before that call, from a copy kept in ${kept} or on the stack.`
        : `Keep a value that must survive a call in ${kept}, or save it on the stack.`;
    notes.push(
      `${reader}, but ${call} overwrote it. ${reg} is caller-saved: a library ` +
        `function may change ${changed} without putting them back, so the caller ` +
        `has to keep anything it still needs. ${fix}`,
    );
  }
  return notes;
}
