/**
 * The console note for a register a program read after a library call had
 * overwritten it. The machine reports plain numbers, four per note
 * (`[register, readBy, callLine, readLine]`, from the wasm
 * `take_clobber_notes`), and the words live here, beside the source they
 * take function names from.
 */
import { MAIN_FILE, resolveLine, type Workspace } from "@/lib/playground/file-map";

/** What a library call leaves in each 64 bits of a caller-saved register. */
export const CLOBBER_HEX = "deadbeefdeadbeef";

/** Whether vector register `index` went from `prev` to `next` ("0x" + 32 hex
 *  digits) only by a library call's overwrite: the pattern in both halves,
 *  or, for v8-v15, in the top half above an unchanged low half. */
export function isCallLeftover(index: number, prev?: string, next?: string): boolean {
  if (next?.slice(2, 18) !== CLOBBER_HEX) return false;
  const low = next.slice(18);
  return index >= 8 && index < 16 ? prev?.slice(18) === low : low === CLOBBER_HEX;
}

/** What read the register: an instruction, a library call taking it as an
 *  argument, or main's return handing it back as the exit status. */
const READ_BY_CALL = 1;
const READ_BY_MAIN_RETURN = 2;

/** The code the machine gives the condition flags: 31, which no x register
 *  uses (x0-x30 are 0-30, d0-d31 are 32-63). */
const FLAGS = 31;

/** A line the machine reported, found in the file it belongs to. */
interface Place {
  /** The helper file's name, or null for the main buffer. */
  file: string | null;
  line: number;
  text: string;
}

/** The machine numbers lines in the one string the files were joined into;
 *  a student reads them per file. */
function place(line: number, ws: Workspace): Place {
  const loc = resolveLine(line, ws.main, ws.extras);
  const main = loc.file === MAIN_FILE;
  const body = main ? ws.main : ws.extras[loc.file].body;
  return { file: main ? null : loc.name, line: loc.line, text: body.split(/\r?\n/)[loc.line - 1] ?? "" };
}

/** "line 16", or "ui.s line 269" in a helper file. */
function at(p: Place): string {
  return p.file ? `${p.file} line ${p.line}` : `line ${p.line}`;
}

/** The same, starting a sentence. */
function startAt(p: Place): string {
  return p.file ? at(p) : `Line ${p.line}`;
}

/** "the printf call on line 16", naming the function from the `bl` the
 *  line holds; a line the machine could not map is just "a library call". */
function callOnLine(ws: Workspace, line: number): string {
  if (line <= 0) return "a library call";
  const p = place(line, ws);
  const callee = /\bbl\s+([A-Za-z_.$][\w.$]*)/i.exec(p.text)?.[1];
  return `the ${callee ?? "library"} call on ${at(p)}`;
}

/** The instruction on a line, past any labels: "b.eq" in "again: b.eq done". */
function mnemonic(text: string): string | undefined {
  return /^\s*(?:[A-Za-z_.$][\w.$]*:\s*)*([A-Za-z][\w.]*)/.exec(text)?.[1];
}

/** Word the rows against the workspace the machine assembled, whose joined
 *  lines they number. */
export function clobberNoteTexts(rows: readonly number[], ws: Workspace): string[] {
  const notes: string[] = [];
  for (let i = 0; i + 3 < rows.length; i += 4) {
    const [code, readBy, callLine, readLine] = rows.slice(i, i + 4);
    const call = callOnLine(ws, callLine);
    const read = readLine > 0 ? place(readLine, ws) : null;
    if (code === FLAGS) {
      const op = read && mnemonic(read.text);
      const reader = read ? (op ? `${op} on ${at(read)}` : startAt(read)) : "The program";
      notes.push(
        `${reader} reads the flags, but ${call} overwrote them. A library call ` +
          "may change the condition flags (NZCV), so compare again after the call.",
      );
      continue;
    }
    const isX = code < 32;
    const reg = isX ? `x${code}` : `d${code - 32}`;
    if (readBy === READ_BY_MAIN_RETURN) {
      notes.push(
        `main returns ${reg} as its exit status, but ${call} overwrote it. ` +
          "Set w0 after the last call, for example with mov w0, 0.",
      );
      continue;
    }
    const readingCall = callOnLine(ws, readLine);
    const reader =
      readBy === READ_BY_CALL
        ? `${readingCall[0].toUpperCase()}${readingCall.slice(1)} reads ${reg} as an argument`
        : read
          ? `${startAt(read)} reads ${reg}`
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
