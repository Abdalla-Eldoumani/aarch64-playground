import type { DecodedInstruction } from "@/lib/emulator/disassembly";
import type { MemoryRegion } from "@/lib/emulator/memory-map";
import type { ReplayFrame } from "@/lib/emulator/replay";
import type { Workspace } from "@/lib/playground/file-map";
import type { ExternalCall } from "@/lib/worker/protocol";

/**
 * What the emulator hub hands the playground, panels, terminal, and tests. A
 * key added here must also be filled in use-emulator.ts and in the shared
 * test fake.
 */

/** A register file the registers panel can show: x0-x30, d0-d31, or v0-v31. */
export type RegView = "x" | "d" | "v";

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
  /** d0-d31 as raw IEEE-754 bit patterns ("0x..."); [] until the loaded WASM
   *  ships the FP surface, which is the UI's cue to hide the d-view. */
  fpRegisters: string[];
  /** v0-v31 as "0x" + 32 hex digits; [] until the loaded WASM ships the vector
   *  surface, which is the UI's cue to hide the v-view. */
  vectorRegisters: string[];
  sp: string;
  pc: number;
  nzcv: number;
  changedRegs: Set<number>;
  changedFpRegs: Set<number>;
  isRunning: boolean;
  /** True while an assemble is in flight. The FIRST assemble also fetches
   *  and compiles the wasm inside the worker, which can take visible time
   * on a cold load; without this flag that first click looks like a hang. */
  isAssembling: boolean;
  isHalted: boolean;
  /** True only while a successfully assembled (or state-restored) program
   *  is in the machine. `run`, `step`, and `stepBack` are inert without
   *  one; reset and a failed assemble drop the flag. */
  programLoaded: boolean;
  error: string | null;
  assemblyErrors: AssemblyError[];
  breakpoints: Set<number>;
  /** Breakpoint lines the last assemble dropped because no instruction runs
   *  at or after them, else empty. Each drop gives a new array, so the shell
   *  can say why a dot vanished. */
  droppedBreakpoints: number[];
  currentLine: number | null;
  /** The library call the paused pc is inside, else null. When set,
   *  `currentLine` is the calling line, since the call's own steps run no
   *  line the student wrote. Null mid-run, where calls pass too fast to
   *  show, and on older wasm builds. */
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
  /** Plain-language notes about the run, shown under the output: today, a
   *  caller-saved register read after a library call overwrote it. */
  notes: string[];
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
   *  callers can chain work (input seeding, run) on a loaded program.
   *  `workspace` is the files `source` joins, when it joins more than one:
   *  the notes name lines per file through it. */
  assemble: (source: string, args?: string[], workspace?: Workspace) => Promise<boolean>;
  /** Assemble for the terminal toolchain: same machine bookkeeping, but
   *  the precise verdict comes back directly and the editor's error
   *  markers stay untouched. */
  assembleForTool: (
    source: string,
    args?: string[],
    workspace?: Workspace,
  ) => Promise<AssembleOutcome>;
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
  /** Move every breakpoint line through `remap` (null drops it). Lines count
   *  through all the files joined, so an edit that changes one file's length
   *  renumbers them; remapping keeps each on its own instruction. */
  remapBreakpoints: (remap: (line: number) => number | null) => void;
  /** Cached bytes for `[addr, addr + len)`. A miss returns an empty array
   *  and fetches in the background; the bytes arrive on a later render. */
  getMemory: (addr: number, len: number) => Uint8Array;
  /** Whether the range is mapped: true/false once known, null while
   *  the async verdict is in flight (render a pending placeholder). */
  getMemoryMapped: (addr: number, len: number) => boolean | null;
  /** The bytes of `[addr, addr + len)` read from the machine itself, for a
   *  reader that cannot wait a render for `getMemory`'s cache (the
   *  diagnostic bundle). Empty when no machine is loaded. */
  readMemory: (addr: number, len: number) => Promise<Uint8Array>;
  /** Queue stdin. `interactive` marks a line typed at a prompt, which the
   *  machine echoes as a read takes it so the console reads like a terminal.
   *  Redirects leave it off, since a redirect prints nothing, and so do the
   *  terminal's own keys, which the pane echoes itself. */
  pushStdin: (s: string, interactive?: boolean) => void;
  /** Everything pushed to stdin since the last assemble or reset (its last
   *  100 KiB): the machine drops input once a read consumes it, and a bug
   *  report needs what the program was given. */
  stdinGiven: () => string;
  /** Continue a run that stopped at a read once the console answers it. A
   *  step that reached a read waits for the next step instead, and the
   *  terminal resumes its own sessions. */
  resumeAfterInput: () => void;
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
  /** Rebuild a bookmark: assemble its source and args, queue its stdin, and
   *  step to `stepCount`. `success` is false when the source no longer
   *  assembles; `stepped` is how far it got before a halt, fault, or read. */
  restoreBookmark: (params: {
    source: string;
    args?: string;
    stdin?: string;
    stepCount: number;
  }) => Promise<{ success: boolean; stepped: number }>;
  clearConsole: () => void;
  /**
   * Most-recent snapshot's `(addr, len)` memory writes. Drives the
   * replay scrubber's memory-diff highlighting
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
