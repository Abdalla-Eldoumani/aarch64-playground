import type { DecodedInstruction } from "@/lib/emulator/disassembly";
import type { MemoryRegion } from "@/lib/emulator/memory-map";
import type { ReplayFrame } from "@/lib/emulator/replay";
import type { ExternalCall } from "@/lib/worker/protocol";

/**
 * The frozen contract between the emulator hub and everything that renders
 * it. useEmulator composes several internal modules, but this shape is what
 * the playground, the panels, the terminal, and every test see; a key added
 * here has to be answered in use-emulator.ts and in the typed fake the
 * component suites share.
 */

export interface AssemblyError {
  line: number;
  message: string;
}

/** The direct verdict of one assemble attempt, returned to tool callers
 *  (the terminal's gcc) so they never read error state that has not
 *  flushed through React yet. */
export interface AssembleOutcome {
  success: boolean;
  error: string | null;
  errorLine: number | null;
}

export interface EmulatorState {
  isLoaded: boolean;
  loadError: string | null;
  registers: string[];
  /** d0-d31 as raw IEEE-754 bit patterns ("0x…"); [] until the loaded WASM
   *  ships the FP surface, which is the UI's cue to hide the d-view. */
  fpRegisters: string[];
  sp: string;
  pc: number;
  nzcv: number;
  changedRegs: Set<number>;
  changedFpRegs: Set<number>;
  isRunning: boolean;
  /** True while an assemble is in flight. The FIRST assemble also fetches
   *  and compiles the wasm inside the worker, which can take visible time
   *  on a cold load -- without this flag that first click looks like a
   *  hang. */
  isAssembling: boolean;
  isHalted: boolean;
  /** True only while a successfully assembled (or state-restored) program
   *  is in the machine. `run`, `step`, and `stepBack` are inert without
   *  one; reset and a failed assemble drop the flag. */
  programLoaded: boolean;
  error: string | null;
  assemblyErrors: AssemblyError[];
  breakpoints: Set<number>;
  currentLine: number | null;
  /**
   * The external call the paused pc sits inside, or null when the pc is one
   * of the program's own instructions. Non-null means `currentLine` is the
   * call SITE, not the executing address -- the three steps a hosted call
   * takes land on a trampoline and a synthetic stub, neither of which is a
   * line the student wrote. Always null while the program is running (a
   * full run passes through dozens of calls a second) and on wasm builds
   * that predate the export.
   */
  externalCall: ExternalCall | null;
  instructions: DecodedInstruction[];
  codeBase: number;
  /**
   * The emulator's address bands, read once at load. Empty on a wasm build
   * that predates the export, which is the memory panel's cue to fall back
   * to its own section list.
   */
  memoryRegions: MemoryRegion[];
  stdout: string;
  stderr: string;
  blocked: boolean;
  /** True once the running program put the terminal in raw mode; the
   *  terminal pane takes over I/O and the console stays quiet. */
  wantsTerminal: boolean;
  /** Route program stdout away from the console (into the terminal
   *  pane) while a tap is set; pass null to restore console routing. */
  setOutputTap: (tap: ((text: string) => void) | null) => void;
  exitCode: number | null;
  hostedMode: boolean;
  vfsFiles: string[];
  /** Resolves true on a successful assemble, false on any failure, so
   *  callers can chain work (input seeding, run) on a loaded program. */
  assemble: (source: string, args?: string[]) => Promise<boolean>;
  /** Assemble for the terminal toolchain: same machine bookkeeping, but
   *  the precise verdict comes back directly and the editor's error
   *  markers stay untouched. */
  assembleForTool: (source: string, args?: string[]) => Promise<AssembleOutcome>;
  step: () => void;
  stepBack: () => void;
  canStepBack: boolean;
  stepCount: number;
  savedStates: string[];
  saveState: (name: string) => void;
  loadState: (name: string) => void;
  deleteState: (name: string) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  toggleBreakpoint: (line: number) => void;
  /** Drop every breakpoint, gutter and CPU alike (program switch). */
  clearAllBreakpoints: () => void;
  /**
   * Move every stored gutter line through `remap` (null drops it). The
   * multi-file workspace keys breakpoints by COMBINED-string line, so an
   * edit that changes any file's length re-numbers them all; the playground
   * re-anchors them here rather than letting the next assemble arm an
   * address belonging to a different instruction.
   */
  remapBreakpoints: (remap: (line: number) => number | null) => void;
  /**
   * Returns the cached bytes for `[addr, addr + len)`. On a cache miss
   * the returned array is empty and an async fetch is queued; the next
   * render delivers the bytes via state. Memory panels render a
   * "loading" placeholder while empty.
   */
  getMemory: (addr: number, len: number) => Uint8Array;
  /** Whether the range is mapped: true/false once known, null while
   *  the async verdict is in flight (render a pending placeholder). */
  getMemoryMapped: (addr: number, len: number) => boolean | null;
  /**
   * Queue stdin. `interactive` marks a line the student typed at a prompt:
   * the machine echoes it into stdout as a read consumes it, so the console
   * transcript reads "Enter score 1: 10" the way the terminal pane does.
   * Redirects (seeds, `< file`, the terminal's own keystrokes) leave it off
   * -- a redirect prints nothing, and the pane echoes for itself.
   */
  pushStdin: (s: string, interactive?: boolean) => void;
  /** Pause/resume the step-back snapshot ring (terminal sessions). */
  setSnapshotsPaused: (paused: boolean) => void;
  /** Signal end-of-input (ctrl-d): getchar sees EOF, scanf finishes. */
  closeStdin: () => void;
  uploadVfsFile: (path: string, data: Uint8Array) => void;
  readVfsFile: (path: string) => Promise<Uint8Array>;
  deleteVfsFile: (path: string) => Promise<boolean>;
  resolveLabel: (name: string) => Promise<number | null>;
  /** Pre-assembly structural lint: advisory warnings with a line and a
   *  one-line remedy. Empty on a wasm build that predates the export. */
  lint: (source: string) => Promise<AssemblyError[]>;
  /** Standalone m4 pass for the terminal; null when the WASM predates it. */
  m4Expand: (source: string) => Promise<{ success: boolean; text?: string; error?: string; error_line?: number } | null>;
  /** Address-based breakpoint setter, used by `gdb b <label>` once the
   *  label resolves. The line-based `toggleBreakpoint` stays the
   *  primary path for the gutter UI. */
  setBreakpointAddress: (addr: number) => Promise<void>;
  clearBreakpointAddress: (addr: number) => Promise<void>;
  /**
   * Restore a named bookmark: assemble the saved source with the saved
   * args, push the saved stdin (if any), then step the live CPU forward
   * to `stepCount` (clamped to the run ceiling). Resolves a verdict --
   * `success` false means the saved source no longer assembles, and
   * `stepped` is how far the machine actually got (a halt, fault, or
   * input wait stops the walk early) so the caller reports the truth.
   */
  restoreBookmark: (params: {
    source: string;
    args?: string;
    stdin?: string;
    stepCount: number;
  }) => Promise<{ success: boolean; stepped: number }>;
  clearConsole: () => void;
  /**
   * Most-recent snapshot's `(addr, len)` memory writes. Drives the
   * replay scrubber's memory-diff highlighting and any future
   * "show me what changed last step" UI.
   */
  dirtyAddrs: Array<[number, number]>;
  /**
   * Last N captured frames for the replay scrubber. Populated after
   * every step and run stop. Capacity 128.
   */
  replayFrames: ReplayFrame[];
  /**
   * Apply a captured frame's registers/PC/currentLine to React state
   * for visual scrubbing. Does not touch the underlying CPU; the next
   * forward `step` resumes from the live PC.
   */
  seekReplay: (frameIndex: number) => void;
}
