/**
 * The multi-file program model: main.asm plus any number of extra source
 * files, concatenated into the one string the assembler sees. This module
 * is the single source of truth for that concatenation and for translating
 * line numbers between the combined string and the individual files, so
 * error markers, the current-line marker, breakpoints, and jump-to-error
 * all land in the right file at the right line.
 */

/** One auxiliary source file in the workspace (main.asm is implicit). */
export interface SourceFile {
  name: string;
  body: string;
}

/** `file` value meaning the implicit main.asm buffer. */
export const MAIN_FILE = -1;

/** A combined-line location resolved back to its owning file. */
export interface FileLocation {
  /** MAIN_FILE for main.asm, otherwise the index into the extras list. */
  file: number;
  /** Display name ("main.asm" for the main buffer). */
  name: string;
  /** 1-based line within that file. */
  line: number;
}

function boundaryComment(name: string): string {
  return `// ---- ${name} ----`;
}

/**
 * Concatenate main + extras with a file-boundary comment BEFORE each
 * extra. main.asm must stay line-for-line identical to the editor buffer:
 * a header line above it would shift every line-map entry, error line, and
 * breakpoint by one for the whole session, since the editor shows main.asm
 * while the assembler sees the combined string.
 */
export function combineSources(main: string, extras: SourceFile[]): string {
  if (extras.length === 0) return main;
  const parts = [main];
  for (const f of extras) {
    parts.push(boundaryComment(f.name));
    parts.push(f.body);
  }
  return parts.join("\n");
}

/** 1-based line count of a buffer (an empty buffer is one line). Exported
 *  because the combined-line translation depends only on line COUNTS, so a
 *  caller can tell a layout-changing edit from a same-shape one. */
export function countLines(text: string): number {
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
}

const lineCount = countLines;

/** Names the implicit main buffer already answers to. A helper tab wearing
 *  one of them is a decoy: it still concatenates, and every diagnostic
 *  inside it is labelled main.asm by `resolveLine`. */
const MAIN_NAMES = /^main\.(asm|s)$/i;

/**
 * Whether `name` may be used for the helper file at `exceptIndex` (omit for
 * a new tab). Returns a student-facing reason, or null when the name is
 * fine. Duplicate names are compared exactly: the course servers are
 * case-sensitive, so `Q.s` and `q.s` are genuinely two files.
 */
export function validateFileName(
  name: string,
  files: SourceFile[],
  exceptIndex?: number,
): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "file name cannot be empty";
  if (MAIN_NAMES.test(trimmed)) {
    return "main.asm is the editor's own buffer -- pick another name";
  }
  const clash = files.some((f, i) => i !== exceptIndex && f.name === trimmed);
  if (clash) return `a file named ${trimmed} is already open`;
  return null;
}

/**
 * Resolve a 1-based line in the combined string to its owning file and
 * local line. Boundary-comment lines attribute to line 1 of the file they
 * introduce, so a diagnostic can never fall between files. Lines past the
 * end resolve to the last line of the last file.
 */
export function resolveLine(
  combinedLine: number,
  main: string,
  extras: SourceFile[],
): FileLocation {
  let remaining = combinedLine;
  const mainLines = lineCount(main);
  if (remaining <= mainLines || extras.length === 0) {
    return {
      file: MAIN_FILE,
      name: "main.asm",
      line: Math.max(1, Math.min(remaining, mainLines)),
    };
  }
  remaining -= mainLines;
  for (let i = 0; i < extras.length; i++) {
    // The boundary comment occupies one combined line ahead of the body.
    remaining -= 1;
    const bodyLines = lineCount(extras[i].body);
    if (remaining <= bodyLines || i === extras.length - 1) {
      return {
        file: i,
        name: extras[i].name,
        line: Math.max(1, Math.min(remaining, bodyLines)),
      };
    }
    remaining -= bodyLines;
  }
  // Unreachable: the loop always returns on the last extra.
  return { file: MAIN_FILE, name: "main.asm", line: 1 };
}

/**
 * The combined-string line for a local line of one file. Inverse of
 * `resolveLine` for in-range inputs.
 */
export function combinedLineFor(
  file: number,
  line: number,
  main: string,
  extras: SourceFile[],
): number {
  if (file === MAIN_FILE) return line;
  let base = lineCount(main);
  for (let i = 0; i < extras.length && i < file; i++) {
    base += 1 + lineCount(extras[i].body);
  }
  return base + 1 + line;
}
