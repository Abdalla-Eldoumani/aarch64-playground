/**
 * Replay buffer for the step-range scrubber. Captures the last N
 * snapshot frames as the user steps the program; the scrubber UI
 * reads `range()` to populate its slider.
 *
 * The ring is fixed-capacity (default 128). Once full, pushing evicts
 * the oldest frame. Frames are stored in insertion order; `range()`
 * returns oldest-to-newest.
 *
 * Replay is visual-only: scrubbing applies a captured frame's
 * registers / sp / fp registers / changedRegs / currentLine to the React
 * tree without touching the underlying CPU. Stepping forward resumes from
 * the live PC.
 */
export interface ReplayFrame {
  stepCount: number;
  registers: string[];
  sp: string;
  fpRegisters: string[];
  pc: number;
  nzcv: number;
  changedRegs: number[];
  changedFpRegs: number[];
  currentLine: number | null;
}

export class ReplayRing {
  private frames: ReplayFrame[] = [];
  private cap: number;

  constructor(cap = 128) {
    if (cap <= 0) throw new Error("ReplayRing capacity must be positive");
    this.cap = cap;
  }

  push(frame: ReplayFrame): void {
    this.frames.push(frame);
    if (this.frames.length > this.cap) {
      this.frames.shift();
    }
  }

  range(): ReplayFrame[] {
    return this.frames.slice();
  }

  size(): number {
    return this.frames.length;
  }

  at(idx: number): ReplayFrame | null {
    return this.frames[idx] ?? null;
  }

  clear(): void {
    this.frames = [];
  }
}
