import { useCallback, useEffect, useRef, useState } from "react";
import {
  EmulatorInstance,
  loadEmulator,
  type AssembleResult,
} from "./emulator";

export interface AssemblyError {
  line: number;
  message: string;
}

export interface DecodedInstruction {
  address: number;
  hex: string;
  text: string;
}

export interface EmulatorState {
  isLoaded: boolean;
  loadError: string | null;
  registers: string[];
  sp: string;
  pc: number;
  nzcv: number;
  changedRegs: Set<number>;
  isRunning: boolean;
  isHalted: boolean;
  error: string | null;
  assemblyErrors: AssemblyError[];
  breakpoints: Set<number>;
  currentLine: number | null;
  instructions: DecodedInstruction[];
  codeBase: number;
  /// Accumulated stdout since the last `clearConsole`.
  stdout: string;
  /// Accumulated stderr.
  stderr: string;
  /// True when the program is waiting for stdin (scanf / read(0)).
  blocked: boolean;
  /// `exit(code)` status, if the program called it.
  exitCode: number | null;
  /// True when the source triggers hosted-mode features (libc calls, data
  /// sections, `.global main`). See `detectHostedMode` for the heuristic.
  hostedMode: boolean;
  /// Filenames currently registered with the virtual FS.
  vfsFiles: string[];
  assemble: (source: string, args?: string[]) => void;
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
  getMemory: (addr: number, len: number) => Uint8Array;
  pushStdin: (s: string) => void;
  uploadVfsFile: (path: string, data: Uint8Array) => void;
  clearConsole: () => void;
}

/// Heuristic: does the source look like a hosted cpsc 355 program that
/// expects libc and a `main` entry point? Anything that references a libc
/// stub, declares `.global main`, or populates `.data`/`.rodata` counts.
function detectHostedMode(source: string): boolean {
  const stripped = source
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").replace(/;.*$/, ""))
    .join("\n");
  if (/\.(global|globl)\s+main\b/.test(stripped)) return true;
  if (/\.(data|rodata|bss)\b/.test(stripped)) return true;
  const libc = [
    "printf",
    "scanf",
    "puts",
    "putchar",
    "getchar",
    "strlen",
    "strcmp",
    "strcpy",
    "memset",
    "memcpy",
    "exit",
    "atof",
  ];
  const pattern = new RegExp(`\\bbl\\s+(${libc.join("|")})\\b`, "i");
  return pattern.test(stripped);
}

export function useEmulator(): EmulatorState {
  const emuRef = useRef<EmulatorInstance | null>(null);
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const instructionCountRef = useRef(0);
  const sourceRef = useRef("");

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registers, setRegisters] = useState<string[]>(
    () => Array(31).fill("0x0000000000000000")
  );
  const [sp, setSp] = useState("0x0000000080000000");
  const [pc, setPc] = useState(0x400000);
  const [nzcv, setNzcv] = useState(0);
  const [changedRegs, setChangedRegs] = useState<Set<number>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [isHalted, setIsHalted] = useState(false);
  const [canStepBack, setCanStepBack] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assemblyErrors, setAssemblyErrors] = useState<AssemblyError[]>([]);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [instructions, setInstructions] = useState<DecodedInstruction[]>([]);
  const [codeBase, setCodeBase] = useState(0x400000);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [hostedMode, setHostedMode] = useState(false);
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);

  // load WASM on mount
  useEffect(() => {
    let cancelled = false;
    loadEmulator()
      .then((emu) => {
        if (cancelled) return;
        emuRef.current = emu;
        setCodeBase(emu.codeBase());
        setIsLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncState = useCallback(() => {
    const emu = emuRef.current;
    if (!emu) return;

    const regs = emu.getAllRegisters();
    setRegisters(regs.gpr);
    setSp(regs.sp);
    setPc(Number(BigInt("0x" + regs.pc.slice(2))));
    setNzcv(regs.nzcv);

    const changed = emu.getChangedRegisters();
    setChangedRegs(new Set(changed));

    setIsHalted(emu.isHalted());
    setBlocked(emu.isBlocked());
    setExitCode(emu.getExitCode());
    setCanStepBack(emu.canStepBack());

    // Drain any stdout/stderr the hosted runtime produced this step.
    const out = emu.takeStdout();
    if (out.length > 0) setStdout((prev) => prev + out);
    const err = emu.takeStderr();
    if (err.length > 0) setStderr((prev) => prev + err);

    // compute current source line from PC
    const currentPc = emu.getPc();
    const base = emu.codeBase();
    if (currentPc >= base) {
      const instrIndex = (currentPc - base) / 4;
      setCurrentLine(pcToSourceLine(instrIndex, sourceRef.current));
    }
  }, []);

  const assemble = useCallback(
    (source: string, args: string[] = []) => {
      const emu = emuRef.current;
      if (!emu) return;

      sourceRef.current = source;
      setError(null);
      setAssemblyErrors([]);
      setIsRunning(false);
      runningRef.current = false;
      setStepCount(0);
      setHostedMode(detectHostedMode(source));

      // stripping comments and whitespace tells us whether there's anything
      // to assemble at all; the rust assembler accepts empty input but the
      // result is a zero-instruction program that can't be stepped
      const hasContent = source
        .split("\n")
        .some((line) => {
          const trimmed = line.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
          return trimmed.length > 0 && !trimmed.endsWith(":");
        });
      if (!hasContent) {
        setError("no instructions to assemble");
        setInstructions([]);
        return;
      }

      const result: AssembleResult =
        args.length > 0
          ? emu.assembleAndLoadWithArgs(source, args)
          : emu.assembleAndLoad(source);

      if (!result.success) {
        const errors: AssemblyError[] = [];
        if (result.error_line != null && result.error != null) {
          errors.push({ line: result.error_line, message: result.error });
        }
        setAssemblyErrors(errors);
        setError(result.error);
        return;
      }

      instructionCountRef.current = result.instruction_count;

      // build instruction list by reading encoded bytes
      const instrs: DecodedInstruction[] = [];
      const base = emu.codeBase();
      for (let i = 0; i < result.instruction_count; i++) {
        const addr = base + i * 4;
        const bytes = emu.getMemoryRange(addr, 4);
        const word =
          bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
        const hex = "0x" + (word >>> 0).toString(16).padStart(8, "0");
        const srcLine = getSourceLineText(i, source);
        instrs.push({ address: addr, hex, text: srcLine });
      }
      setInstructions(instrs);

      syncState();
    },
    [syncState]
  );

  const step = useCallback(() => {
    const emu = emuRef.current;
    if (!emu) return;

    setError(null);
    const result = emu.step();
    if (result.error) {
      setError(result.error);
    }
    setStepCount((c) => c + 1);
    syncState();
  }, [syncState]);

  const stepBack = useCallback(() => {
    const emu = emuRef.current;
    if (!emu) return;
    setError(null);
    emu.stepBack();
    setStepCount((c) => Math.max(0, c - 1));
    syncState();
  }, [syncState]);

  const [savedStates, setSavedStates] = useState<string[]>([]);
  const refreshSaves = useCallback(() => {
    const emu = emuRef.current;
    if (!emu) return;
    setSavedStates(emu.listStates());
  }, []);
  const saveState = useCallback(
    (name: string) => {
      const emu = emuRef.current;
      if (!emu || !name) return;
      emu.saveState(name);
      refreshSaves();
    },
    [refreshSaves],
  );
  const loadState = useCallback(
    (name: string) => {
      const emu = emuRef.current;
      if (!emu) return;
      if (emu.loadState(name)) {
        syncState();
      }
    },
    [syncState],
  );
  const deleteState = useCallback(
    (name: string) => {
      const emu = emuRef.current;
      if (!emu) return;
      emu.deleteState(name);
      refreshSaves();
    },
    [refreshSaves],
  );

  const run = useCallback(() => {
    const emu = emuRef.current;
    if (!emu || emu.isHalted()) return;

    setIsRunning(true);
    runningRef.current = true;

    const tick = () => {
      if (!runningRef.current || !emuRef.current) return;

      const result = emuRef.current.runUntilBreak(10000);
      setStepCount((c) => c + result.steps_executed);
      syncState();

      if (result.error) {
        setError(result.error);
        setIsRunning(false);
        runningRef.current = false;
        return;
      }

      if (result.halted || result.hit_breakpoint) {
        setIsRunning(false);
        runningRef.current = false;
        return;
      }

      // run_until_break also exits if the CPU is now blocked on stdin.
      if (emuRef.current.isBlocked()) {
        setIsRunning(false);
        runningRef.current = false;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [syncState]);

  const pause = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    const emu = emuRef.current;
    if (!emu) return;

    pause();
    emu.reset();
    setError(null);
    setAssemblyErrors([]);
    setInstructions([]);
    setCurrentLine(null);
    setStdout("");
    setStderr("");
    setBlocked(false);
    setExitCode(null);
    setVfsFiles([]);
    setStepCount(0);
    syncState();
  }, [pause, syncState]);

  const pushStdin = useCallback(
    (s: string) => {
      const emu = emuRef.current;
      if (!emu) return;
      emu.pushStdin(s);
      setBlocked(false);
      // If the program was paused waiting for input, a single step resumes
      // it; the caller (ConsolePanel) usually wants to continue running.
      if (runningRef.current) {
        return;
      }
      // Auto-step once so the stalled scanf/read drains the new input and
      // the UI reflects the updated register state immediately.
      emu.step();
      syncState();
    },
    [syncState]
  );

  const uploadVfsFile = useCallback(
    (path: string, data: Uint8Array) => {
      const emu = emuRef.current;
      if (!emu) return;
      emu.uploadVfsFile(path, data);
      setVfsFiles(emu.listVfsFiles());
    },
    []
  );

  const clearConsole = useCallback(() => {
    const emu = emuRef.current;
    if (!emu) return;
    emu.clearConsole();
    setStdout("");
    setStderr("");
  }, []);

  const toggleBreakpoint = useCallback(
    (line: number) => {
      const emu = emuRef.current;
      if (!emu) return;

      const instrIndex = sourceLineToInstrIndex(line, sourceRef.current);
      if (instrIndex === null) return;

      const addr = emu.codeBase() + instrIndex * 4;

      setBreakpoints((prev) => {
        const next = new Set(prev);
        if (next.has(line)) {
          next.delete(line);
          emu.clearBreakpoint(addr);
        } else {
          next.add(line);
          emu.setBreakpoint(addr);
        }
        return next;
      });
    },
    []
  );

  const getMemory = useCallback(
    (addr: number, len: number): Uint8Array => {
      const emu = emuRef.current;
      if (!emu) return new Uint8Array(len);
      return emu.getMemoryRange(addr, len);
    },
    []
  );

  return {
    isLoaded,
    loadError,
    registers,
    sp,
    pc,
    nzcv,
    changedRegs,
    isRunning,
    isHalted,
    error,
    assemblyErrors,
    breakpoints,
    currentLine,
    instructions,
    codeBase,
    stdout,
    stderr,
    blocked,
    exitCode,
    hostedMode,
    vfsFiles,
    assemble,
    step,
    stepBack,
    canStepBack,
    stepCount,
    savedStates,
    saveState,
    loadState,
    deleteState,
    run,
    pause,
    reset,
    toggleBreakpoint,
    getMemory,
    pushStdin,
    uploadVfsFile,
    clearConsole,
  };
}

// ---------------------------------------------------------------------------
// helpers: map between source lines and instruction indices
// ---------------------------------------------------------------------------

function pcToSourceLine(instrIndex: number, source: string): number | null {
  const lines = source.split("\n");
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
    if (!trimmed || trimmed.endsWith(":")) continue;
    if (idx === instrIndex) return i + 1; // 1-based
    idx++;
  }
  return null;
}

function sourceLineToInstrIndex(
  line: number,
  source: string
): number | null {
  const lines = source.split("\n");
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
    if (!trimmed || trimmed.endsWith(":")) continue;
    if (i + 1 === line) return idx;
    idx++;
  }
  return null;
}

function getSourceLineText(instrIndex: number, source: string): string {
  const lines = source.split("\n");
  let idx = 0;
  for (const line of lines) {
    const trimmed = line.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
    if (!trimmed || trimmed.endsWith(":")) continue;
    if (idx === instrIndex) return trimmed;
    idx++;
  }
  return "";
}
