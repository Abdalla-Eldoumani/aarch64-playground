/**
 * The last N register frames for the step scrubber, oldest first; once full,
 * a push drops the oldest. Scrubbing only repaints the panels and never
 * touches the CPU, so stepping forward resumes from the live pc.
 */
export interface ReplayFrame {
  stepCount: number;
  registers: string[];
  sp: string;
  fpRegisters: string[];
  vectorRegisters: string[];
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
