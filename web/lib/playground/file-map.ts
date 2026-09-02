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

/** A workspace as one coordinate space: the main buffer plus its helpers. */
export interface Workspace {
  main: string;
  extras: SourceFile[];
}

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

/** Longest file name the strip accepts. */
const MAX_FILE_NAME_CHARS = 64;

/**
 * The characters a file name may use: it must start with a letter or a digit,
 * then letters, digits, dot, dash, and underscore. Everything else is refused,
 * which is what keeps a name out of `combineSources`'s `// ---- name ----`
 * marker as anything but a comment: a name carrying a newline wrote its own
 * assembly lines into the program the linker saw. Excluding the slash also
 * rules out `../` traversal wherever a name reaches a fetch path.
 */
const FILE_NAME_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Whether `name` is shaped like a file name at all, independent of what is
 * already open. Split out from `validateFileName` because the decode
 * boundaries share the shape rule but not the main.asm rule: a `.json`
 * workspace bundle carries main.asm as its first entry.
 */
export function fileNameShapeError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "file name cannot be empty";
  if (trimmed.length > MAX_FILE_NAME_CHARS) {
    return `file name is too long (max ${MAX_FILE_NAME_CHARS} characters)`;
  }
  if (!FILE_NAME_SHAPE.test(trimmed)) {
    return "file names may use letters, digits, dot, dash, and underscore only";
  }
  return null;
}

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
  const shape = fileNameShapeError(trimmed);
  if (shape) return shape;
  if (MAIN_NAMES.test(trimmed)) {
    return "main.asm is the editor's own buffer; pick another name";
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

// ---------------------------------------------------------------------------
// Per-file views. The editor shows one buffer at a time while every
// diagnostic the machine reports is numbered against the combined string, so
// each of these answers "what does THIS buffer show" for one kind of marker.
// ---------------------------------------------------------------------------

/**
 * The diagnostics that belong to `activeFile`, re-numbered to its local
 * lines. A diagnostic with no position (line 0 or less) belongs to the
 * main buffer's view and keeps its own line untouched.
 */
export function diagnosticsForFile<T extends { line: number }>(
  items: readonly T[],
  main: string,
  extras: SourceFile[],
  activeFile: number,
): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (item.line <= 0) {
      if (activeFile === MAIN_FILE) out.push(item);
      continue;
    }
    const loc = resolveLine(item.line, main, extras);
    if (loc.file === activeFile) out.push({ ...item, line: loc.line });
  }
  return out;
}

/** The stored breakpoints that fall in `activeFile`, as its local lines. */
export function breakpointsForFile(
  stored: Iterable<number>,
  main: string,
  extras: SourceFile[],
  activeFile: number,
): Set<number> {
  const set = new Set<number>();
  for (const line of stored) {
    const loc = resolveLine(line, main, extras);
    if (loc.file === activeFile) set.add(loc.line);
  }
  return set;
}

/**
 * A cheap identity for the workspace's line geometry. Only the SHAPE can
 * move a stored line, so a caller watching this string re-anchors on an
 * inserted line and pays nothing for typing inside one.
 */
export function workspaceShape(main: string, extras: SourceFile[]): string {
  return `${lineCount(main)}|${extras.map((f) => lineCount(f.body)).join(",")}`;
}

/**
 * Where every stored breakpoint moves when the workspace changes shape,
 * or null when none of them move (nothing to re-anchor). A line whose
 * owning file is gone maps to null: a closed tab takes its dots with it
 * rather than donating them to whichever file inherited its numbers.
 */
export function planBreakpointRemap(
  stored: ReadonlySet<number>,
  from: Workspace,
  to: Workspace,
): Map<number, number | null> | null {
  if (stored.size === 0) return null;
  const moved = new Map<number, number | null>();
  let changed = false;
  for (const line of stored) {
    const loc = resolveLine(line, from.main, from.extras);
    const owner = loc.file === MAIN_FILE ? to.main : to.extras[loc.file]?.body;
    const target =
      owner == null
        ? null
        : combinedLineFor(
            loc.file,
            Math.min(loc.line, lineCount(owner)),
            to.main,
            to.extras,
          );
    if (target !== line) changed = true;
    moved.set(line, target);
  }
  return changed ? moved : null;
}

/**
 * A machine error prefixed with the file it happened in, for the single
 * plain-text line Controls shows. Only a helper file earns the prefix:
 * main.asm is the buffer the student is already looking at.
 */
export function errorWithFileName(
  error: string | null,
  firstErrorLine: number | undefined,
  main: string,
  extras: SourceFile[],
): string | null {
  if (!error) return error;
  if (firstErrorLine == null || firstErrorLine <= 0 || extras.length === 0) {
    return error;
  }
  const loc = resolveLine(firstErrorLine, main, extras);
  if (loc.file === MAIN_FILE) return error;
  return `${loc.name} line ${loc.line}: ${error}`;
}
