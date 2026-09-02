/**
 * Split pasted terminal data into command lines. xterm normalizes every
 * pasted line break to a bare carriage return before it reaches onData,
 * so splitting on \n alone never fires for a real clipboard paste; this
 * accepts \r\n, \r, and \n so each pasted line submits as its own
 * command regardless of the source's line-ending convention.
 */
export function splitPasteLines(data: string): string[] {
  return data.split(/\r\n|\r|\n/);
}

const ESCAPE_SEQUENCES = /\x1b(?:\[[0-?]*[ -/]*[@-~]|O[@-~]|[@-Z\\-_])/g;
const CONTROL_BYTES = /[\x00-\x1f\x7f\x80-\x9f]/g;

/**
 * Drop terminal control data from text entering the input buffer: whole
 * ANSI escape sequences first (a special key's CSI/SS3 sequence, or a
 * pasted colored shell transcript), then any remaining C0/C1 control
 * bytes. Tabs become single spaces so pasted token separation survives.
 * The buffer can then never hold bytes that repaint as cursor movement:
 * an ESC[A smuggled into the line is invisible on screen but corrupts
 * the submitted command and scrambles the scrollback on repaint.
 */
export function sanitizeInput(text: string): string {
  return text
    .replace(ESCAPE_SEQUENCES, "")
    .replace(/\t/g, " ")
    .replace(CONTROL_BYTES, "");
}

/**
 * In-memory state for a single terminal input line: buffer + cursor +
 * history navigation + tab completion. Pure logic so it can be unit
 * tested without xterm or the DOM.
 */
export class TerminalInputState {
  buffer = "";
  cursor = 0;
  history: string[] = [];
  /** -1 means "user is editing the current line" (`pending`). */
  private historyIndex = -1;
  /** Snapshot of the in-progress edit before history navigation begins. */
  private pending = "";

  handlePrintable(ch: string): void {
    const clean = sanitizeInput(ch);
    if (!clean) return;
    this.buffer = this.buffer.slice(0, this.cursor) + clean + this.buffer.slice(this.cursor);
    this.cursor += clean.length;
    this.historyIndex = -1;
  }

  handleBackspace(): void {
    if (this.cursor === 0) return;
    this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
    this.cursor -= 1;
    this.historyIndex = -1;
  }

  handleUp(): void {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1) {
      this.pending = this.buffer;
      this.historyIndex = this.history.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex -= 1;
    }
    this.buffer = this.history[this.historyIndex];
    this.cursor = this.buffer.length;
  }

  handleDown(): void {
    if (this.historyIndex === -1) return;
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex += 1;
      this.buffer = this.history[this.historyIndex];
    } else {
      this.historyIndex = -1;
      this.buffer = this.pending;
    }
    this.cursor = this.buffer.length;
  }

  /**
   * Tab completion against a candidate list (typically VFS file names).
   * Looks at the last space-separated word of the buffer; if exactly
   * one candidate has that prefix it expands the buffer; if multiple
   * match it returns them so the caller can print the list.
   */
  handleTab(candidates: string[]): string[] {
    const lastSpace = this.buffer.lastIndexOf(" ");
    const prefix = lastSpace === -1 ? this.buffer : this.buffer.slice(lastSpace + 1);
    if (!prefix) return [];
    const matches = candidates.filter((c) => c.startsWith(prefix));
    if (matches.length === 0) return [];
    if (matches.length === 1) {
      const completion = matches[0];
      const head = lastSpace === -1 ? "" : this.buffer.slice(0, lastSpace + 1);
      this.buffer = head + completion;
      this.cursor = this.buffer.length;
      return [completion];
    }
    return matches;
  }

  /**
   * Push the current line onto history (deduping consecutive copies),
   * clear the buffer, and return what was submitted, or `null` for an empty
   * submission.
   */
  takeSubmission(): string | null {
    const submitted = this.buffer;
    this.buffer = "";
    this.cursor = 0;
    this.historyIndex = -1;
    this.pending = "";
    if (!submitted.trim()) return null;
    this.commit(submitted);
    return submitted;
  }

  /**
   * Push a line onto history without otherwise touching state. Used by
   * tests to seed history; production callers should use takeSubmission.
   */
  commit(line: string): void {
    if (this.history[this.history.length - 1] === line) return;
    this.history.push(line);
  }
}
