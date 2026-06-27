"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useEmulator } from "@/lib/use-emulator";
import { useBreakpoint, isAtLeast } from "@/lib/use-breakpoint";
import { useAutoSave, useRecentPrograms } from "@/lib/auto-save";
import { parseFrameSlots } from "@/lib/frame-labels";
import { parseArgs } from "@/lib/args";
import { formatAsm } from "@/lib/asm-formatter";
import { MAX_VFS_BYTES, checkUploadSize } from "@/lib/upload-guard";
import { useCpsc355Mode } from "@/lib/use-cpsc355-mode";
import { useLectureMode } from "@/lib/use-lecture-mode";
import { useHotspotMode } from "@/lib/use-hotspot-mode";
import {
  describeTarget,
  getImportTarget,
  type ImportTarget,
} from "@/lib/use-import-target";
import type { Action } from "@/lib/commands";
import { Editor } from "@/components/Editor";
import { RegisterPanel } from "@/components/RegisterPanel";
import { ConsolePanel } from "@/components/ConsolePanel";
import { Controls } from "@/components/Controls";
import { CurrentStrip } from "@/components/CurrentStrip";
import { FirstRunState } from "@/components/FirstRunState";
import { ExampleLoader } from "@/components/ExampleLoader";
import { RecentPrograms } from "@/components/RecentPrograms";
import { ResizableLayout } from "@/components/ResizableLayout";
import { MobileLayout } from "@/components/MobileLayout";
import { ImportExport } from "@/components/ImportExport";
import { Toolbar } from "@/components/Toolbar";
import { ArgsInput } from "@/components/ArgsInput";
import { LectureBar } from "@/components/LectureBar";
import {
  MultiFileTabs,
  combineSources,
  useSourceFiles,
  type SourceFile,
} from "@/components/MultiFileTabs";
import { useToast } from "@/components/Toast";

// Full-only / heavy panels load on first render so a multi-embed page (and
// the embed/checker chrome) never ships their code.
const InstructionView = dynamic(
  () => import("@/components/InstructionView").then((m) => m.InstructionView),
  { ssr: false },
);
const MemoryPanel = dynamic(
  () => import("@/components/MemoryPanel").then((m) => m.MemoryPanel),
  { ssr: false },
);
const StackPanel = dynamic(
  () => import("@/components/StackPanel").then((m) => m.StackPanel),
  { ssr: false },
);
const WatchPanel = dynamic(
  () => import("@/components/WatchPanel").then((m) => m.WatchPanel),
  { ssr: false },
);
const MemoryWatches = dynamic(
  () => import("@/components/MemoryWatches").then((m) => m.MemoryWatches),
  { ssr: false },
);
const ReplayScrubber = dynamic(
  () => import("@/components/ReplayScrubber").then((m) => m.ReplayScrubber),
  { ssr: false },
);
const SavesPanel = dynamic(
  () => import("@/components/SavesPanel").then((m) => m.SavesPanel),
  { ssr: false },
);
const TerminalPane = dynamic(
  () => import("@/components/TerminalPane").then((m) => m.TerminalPane),
  { ssr: false, loading: () => null },
);
const TutorialRunner = dynamic(
  () => import("@/components/TutorialRunner").then((m) => m.TutorialRunner),
  { ssr: false },
);

/**
 * The single shared emulator surface. The full playground, the landing
 * hero, the /learn lessons, and the /practice exercises all compose this
 * one component (EMBEDDABLE_COMPONENT.md): it OWNS the single
 * `useEmulator()` hub and renders every panel internally, so the hub's
 * ~30 fields never cross a component boundary. The chrome prop selects
 * the configuration; the full playground is the maximal one.
 */
export type EmbeddableChrome = "full" | "embed" | "checker";

/** Panels a host can force on/off on top of the chrome defaults. */
export type PanelKey =
  | "disassembly"
  | "memory"
  | "stack"
  | "console"
  | "terminal"
  | "watches"
  | "memwatch"
  | "saves";

/**
 * The outcome slice the host reads for in-place output and the future
 * outcome checker. Exactly these ten fields mirror the hub; this is the
 * single definition consumers import (no redeclaration elsewhere).
 */
export type EmbeddableState = {
  registers: string[];
  sp: string;
  pc: number;
  nzcv: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  isRunning: boolean;
  isHalted: boolean;
  error: string | null;
};

/**
 * Imperative handle the host drives the component through. The page-level
 * keyboard shortcuts, command palette, and share dialog all act through
 * this rather than reaching into the hub.
 */
export type EmbeddablePlaygroundHandle = {
  assemble(): void;
  run(): void;
  pause(): void;
  step(): void;
  stepBack(): void;
  reset(): void;
  /** Load a program into the editable buffer (example / recent / bookmark / tutorial). */
  loadSource(source: string, label?: string): void;
  getSource(): string;
  getArgs(): string;
  getCursor(): { line: number; column: number };
  /** The command Action[] built inside the component so a host-rendered
   *  palette has no duplicate logic. */
  getCommands(): Action[];
};

export type EmbeddablePlaygroundProps = {
  chrome: EmbeddableChrome;
  startSource?: string;
  startArgs?: string;
  startStdin?: string;
  startCursor?: { line: number; column: number };
  /** The host knows a program arrived from a share link; drives the banner. */
  fromShare?: boolean;
  /** Hero = non-editable taste; lessons / exercises editable. */
  readOnly?: boolean;
  /** Optional overrides on top of the chrome defaults. */
  panels?: Partial<Record<PanelKey, boolean>>;
  showRun?: boolean;
  showReset?: boolean;
  /** Check only applies in checker chrome. */
  showCheck?: boolean;
  onStateChange?: (state: EmbeddableState) => void;
  /** Checker Check button; the evaluation itself lands in a later milestone. */
  onCheck?: (state: EmbeddableState) => void;
  // Page-chrome hooks: the host renders these modals and owns the theme;
  // the component's full-chrome header triggers them so there is no
  // duplicated palette / share / theme logic.
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenShareDialog?: () => void;
  onToggleTheme?: () => void;
  className?: string;
};

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Inner core: mounted only after the lazy trigger fires, so the hub (and the
// worker / WASM it instantiates) never spins up before the component is
// actually engaged. useEmulator cannot be called conditionally, which is why
// the engage gate lives in the outer component and the hub lives here.
// ---------------------------------------------------------------------------

type EmbeddableCoreProps = EmbeddablePlaygroundProps & {
  registerHandle: (handle: EmbeddablePlaygroundHandle | null) => void;
};

function EmbeddableCore({
  chrome,
  startSource,
  startArgs,
  startStdin,
  startCursor,
  fromShare,
  readOnly,
  showRun = true,
  showReset = true,
  showCheck = true,
  onStateChange,
  onCheck,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onOpenShareDialog,
  onToggleTheme,
  registerHandle,
}: EmbeddableCoreProps) {
  const emu = useEmulator();
  const bp = useBreakpoint();
  const [source, setSource] = useState(startSource ?? "");
  const [activeTab, setActiveTab] = useState<
    "memory" | "stack" | "console" | "term" | "watches" | "memwatch" | "saves"
  >("memory");
  const [argsText, setArgsText] = useState(startArgs ?? "");
  const [shareBanner, setShareBanner] = useState(Boolean(fromShare));
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const cpsc = useCpsc355Mode();
  const lecture = useLectureMode();
  const hotspot = useHotspotMode();
  const [cursor, setCursor] = useState<{ line: number; column: number }>(
    startCursor ?? { line: 1, column: 1 },
  );
  const [extraFiles, setExtraFiles] = useSourceFiles();
  const [activeFile, setActiveFile] = useState<number>(-1);
  const toast = useToast();
  const importTarget = getImportTarget(activeFile);

  const loadSource = useCallback(
    (next: string, _label?: string) => setSource(next),
    [],
  );

  const handleImport = useCallback(
    (target: ImportTarget, body: string) => {
      switch (target.kind) {
        case "main":
          setSource(body);
          toast.show("imported into main.asm");
          return;
        case "extra": {
          const idx = target.index;
          setExtraFiles(
            extraFiles.map((f, i) => (i === idx ? { ...f, body } : f)),
          );
          toast.show(`imported into ${describeTarget(target, extraFiles)}`);
          return;
        }
      }
    },
    [extraFiles, setExtraFiles, toast],
  );

  useAutoSave(source);
  const recent = useRecentPrograms();

  // Push the current buffer onto the recent list whenever the user
  // assembles, and concatenate any extra files so `bl func` resolves across
  // files (the linker operates on one string).
  const assembleWithHistory = useCallback(() => {
    const trimmed = source.trim();
    if (trimmed.length > 0) {
      const firstComment = source
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("//") || l.startsWith(";"));
      const name = firstComment
        ? firstComment.replace(/^(?:\/\/|;)\s*/, "").slice(0, 48)
        : `snippet ${new Date().toLocaleTimeString()}`;
      recent.push(name, source);
    }
    const combined =
      extraFiles.length > 0 ? combineSources(source, extraFiles) : source;
    emu.assemble(combined, parseArgs(argsText));
  }, [source, recent, emu, extraFiles, argsText]);

  // The reduced embed/checker chrome has no separate Assemble control, so its
  // primary Run must assemble first; otherwise runUntilBreak executes over
  // empty memory and nothing the student wrote runs. Assemble when nothing is
  // loaded yet (fresh or post-reset, instructions empty) or the source changed
  // since the last run, awaiting the hub so the backend is loaded before run;
  // an already-assembled, unchanged program runs straight away.
  const lastRunSourceRef = useRef<string | null>(null);
  const runEmbed = useCallback(async () => {
    if (emu.instructions.length === 0 || lastRunSourceRef.current !== source) {
      lastRunSourceRef.current = source;
      await emu.assemble(source, parseArgs(argsText));
    }
    emu.run();
  }, [emu, source, argsText]);

  // Auto-switch to the console on the false->true edge of `blocked` so the
  // student sees the scanf prompt. queueMicrotask defers the flip out of the
  // synchronous render phase.
  const lastBlockedRef = useRef(false);
  useEffect(() => {
    if (emu.blocked && !lastBlockedRef.current) {
      lastBlockedRef.current = true;
      queueMicrotask(() => setActiveTab("console"));
    } else if (!emu.blocked) {
      lastBlockedRef.current = false;
    }
  }, [emu.blocked]);

  // The command Action[] is built here (where source / modes / hub live) and
  // surfaced through the handle so a host-rendered palette reuses it.
  const buildCommands = useCallback(
    (): Action[] => [
      {
        id: "assemble",
        label: "Assemble",
        description: "parse source and load into memory",
        shortcut: "F6",
        run: () => assembleWithHistory(),
      },
      {
        id: "step",
        label: "Step",
        description: "execute one instruction",
        shortcut: "F10",
        run: () => emu.step(),
      },
      {
        id: "step-back",
        label: "Step back",
        description: emu.canStepBack
          ? "undo the last instruction from the snapshot ring"
          : "(no snapshots; run a step first)",
        shortcut: "Shift+F10",
        run: () => emu.stepBack(),
      },
      {
        id: "run",
        label: "Run",
        description: "run until halt or breakpoint",
        shortcut: "F5",
        run: () => emu.run(),
      },
      {
        id: "pause",
        label: "Pause",
        description: "stop the run loop",
        shortcut: "F5",
        run: () => emu.pause(),
      },
      {
        id: "reset",
        label: "Reset",
        description: "clear state, keep breakpoints",
        shortcut: "Shift+F5",
        run: () => emu.reset(),
      },
      {
        id: "share",
        label: "Share link",
        description: "copy a compressed URL",
        run: () => onOpenShareDialog?.(),
      },
      {
        id: "tutorial",
        label: "Start guided tour",
        description: "walk through a concept one step at a time",
        run: () => setTutorialOpen(true),
      },
      {
        id: "toggle-theme",
        label: "Toggle theme",
        description: "switch between dark and light palettes",
        run: () => onToggleTheme?.(),
      },
      {
        id: "format-source",
        label: "Format source",
        description: "lowercase mnemonics and align operand columns",
        shortcut: "Ctrl+Shift+F",
        run: () => {
          const next = formatAsm(source);
          if (next !== source) setSource(next);
          toast.show("source formatted");
        },
      },
      {
        id: "help",
        label: "Keyboard shortcuts",
        description: "open the shortcuts help modal",
        shortcut: "?",
        run: () => onOpenShortcutsHelp?.(),
      },
      {
        id: "import-file",
        label: "Import file",
        description: "open the file picker and load assembly into the active buffer",
        run: () => {
          const el = document.querySelector<HTMLInputElement>(
            'input[type="file"][accept=".s,.asm,.txt"]',
          );
          el?.click();
        },
      },
      {
        id: "download-asm",
        label: "Download as .asm",
        description: "save the current buffer to your computer",
        run: () => {
          const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "program.asm";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
      },
      {
        id: "download-s",
        label: "Download as .s",
        description: "save the current buffer with the .s extension",
        run: () => {
          const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "program.s";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
      },
      {
        id: "copy-source",
        label: "Copy source to clipboard",
        description: "copy the current buffer for pasting elsewhere",
        run: () => {
          void navigator.clipboard?.writeText(source);
        },
      },
      {
        id: "open-source",
        label: "View source on GitHub",
        description: "open the playground repo in a new tab",
        run: () => {
          window.open(
            "https://github.com/Abdalla-Eldoumani/aarch64-playground",
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
    ],
    [emu, assembleWithHistory, source, toast, onOpenShareDialog, onOpenShortcutsHelp, onToggleTheme],
  );

  // Latest-value refs so the imperative handle stays a stable object while
  // still reading live editor / hub state when the host calls a method. The
  // refs are synced in an effect; the react-hooks rules forbid writing a ref
  // during render.
  const emuRef = useRef(emu);
  const sourceRef = useRef(source);
  const argsRef = useRef(argsText);
  const cursorRef = useRef(cursor);
  const onStateChangeRef = useRef(onStateChange);
  const assembleRef = useRef(assembleWithHistory);
  const buildCommandsRef = useRef(buildCommands);
  useEffect(() => {
    emuRef.current = emu;
    sourceRef.current = source;
    argsRef.current = argsText;
    cursorRef.current = cursor;
    onStateChangeRef.current = onStateChange;
    assembleRef.current = assembleWithHistory;
    buildCommandsRef.current = buildCommands;
  }, [emu, source, argsText, cursor, onStateChange, assembleWithHistory, buildCommands]);

  // Seed starter stdin once the hub is live so a program that reads has its
  // input queued before the first run.
  const seededStdin = useRef(false);
  useEffect(() => {
    if (emu.isLoaded && startStdin && !seededStdin.current) {
      seededStdin.current = true;
      emu.pushStdin(startStdin);
    }
  }, [emu, emu.isLoaded, startStdin]);

  // Mirror exactly the ten outcome fields to the host whenever any of them
  // changes. Keyed only on those fields so unrelated hub churn (breakpoints,
  // disassembly, memory ticks) does not fire the callback.
  useEffect(() => {
    onStateChangeRef.current?.({
      registers: emu.registers,
      sp: emu.sp,
      pc: emu.pc,
      nzcv: emu.nzcv,
      stdout: emu.stdout,
      stderr: emu.stderr,
      exitCode: emu.exitCode,
      isRunning: emu.isRunning,
      isHalted: emu.isHalted,
      error: emu.error,
    });
  }, [
    emu.registers,
    emu.sp,
    emu.pc,
    emu.nzcv,
    emu.stdout,
    emu.stderr,
    emu.exitCode,
    emu.isRunning,
    emu.isHalted,
    emu.error,
  ]);

  const currentState = useCallback(
    (): EmbeddableState => ({
      registers: emuRef.current.registers,
      sp: emuRef.current.sp,
      pc: emuRef.current.pc,
      nzcv: emuRef.current.nzcv,
      stdout: emuRef.current.stdout,
      stderr: emuRef.current.stderr,
      exitCode: emuRef.current.exitCode,
      isRunning: emuRef.current.isRunning,
      isHalted: emuRef.current.isHalted,
      error: emuRef.current.error,
    }),
    [],
  );

  // Stable handle identity; every method reads through a latest-value ref so
  // the object never needs rebuilding (no re-registration churn).
  const handle = useMemo<EmbeddablePlaygroundHandle>(
    () => ({
      assemble: () => assembleRef.current(),
      run: () => emuRef.current.run(),
      pause: () => emuRef.current.pause(),
      step: () => emuRef.current.step(),
      stepBack: () => emuRef.current.stepBack(),
      reset: () => emuRef.current.reset(),
      loadSource: (next: string) => loadSource(next),
      getSource: () => sourceRef.current,
      getArgs: () => argsRef.current,
      getCursor: () => cursorRef.current,
      getCommands: () => buildCommandsRef.current(),
    }),
    [loadSource],
  );

  // Register the handle only once the hub is loaded, so a queued host action
  // (flushed by the outer component on registration) lands on a live backend.
  useEffect(() => {
    if (!emu.isLoaded) return;
    registerHandle(handle);
    return () => registerHandle(null);
  }, [emu.isLoaded, handle, registerHandle]);

  // Editor wiring: main buffer vs an extra file tab.
  const isMain = activeFile === -1;
  const editorValue = isMain ? source : extraFiles[activeFile]?.body ?? "";
  const onEditorChange = useCallback(
    (next: string) => {
      if (isMain) {
        setSource(next);
      } else {
        setExtraFiles(
          extraFiles.map((f, i) => (i === activeFile ? { ...f, body: next } : f)),
        );
      }
    },
    [isMain, activeFile, extraFiles, setExtraFiles],
  );

  const frameSlots = useMemo(() => parseFrameSlots(source), [source]);
  const fpValue = useMemo(() => {
    const raw = emu.registers[29];
    if (!raw) return 0;
    const clean = raw.startsWith("0x") ? raw.slice(2) : raw;
    return parseInt(clean, 16) || 0;
  }, [emu.registers]);

  // Hidden file picker the terminal's `upload` command triggers.
  const terminalUploadRef = useRef<HTMLInputElement>(null);
  const buildTerminalContext = useCallback(() => {
    const dec = new TextDecoder();
    return {
      vfs: new Map<string, string>(),
      listVfs: () => emu.vfsFiles.slice().sort(),
      readVfs: async (path: string) => {
        const bytes = await emu.readVfsFile(path);
        if (bytes.length === 0 && !emu.vfsFiles.includes(path)) {
          return undefined; // distinguish missing from empty
        }
        return dec.decode(bytes);
      },
      writeVfs: (path: string, body: string) => {
        const enc = new TextEncoder();
        emu.uploadVfsFile(path, enc.encode(body));
      },
      deleteVfs: async (path: string) => emu.deleteVfsFile(path),
      runProgram: async (args: string[], stdin?: string) => {
        emu.assemble(source, args.slice(1));
        if (stdin) emu.pushStdin(stdin);
        emu.run();
        const startedAt = Date.now();
        while (emu.isRunning) {
          await new Promise<void>((r) => setTimeout(r, 16));
          if (Date.now() - startedAt > 10_000) break;
        }
        return {
          stdout: emu.stdout,
          stderr: emu.stderr,
          exitCode: emu.exitCode ?? 0,
        };
      },
      step: async () => {
        emu.step();
        return { halted: emu.isHalted, line: emu.currentLine };
      },
      runUntilBreak: async () => {
        emu.run();
        const startedAt = Date.now();
        while (emu.isRunning) {
          await new Promise<void>((r) => setTimeout(r, 16));
          if (Date.now() - startedAt > 10_000) break;
        }
        return { halted: emu.isHalted, hit_breakpoint: false };
      },
      setBreakpoint: async (addr: number) => emu.setBreakpointAddress(addr),
      clearBreakpoint: async (addr: number) => emu.clearBreakpointAddress(addr),
      resolveLabel: async (name: string) => emu.resolveLabel(name),
      readRegister: (name: string) => {
        const lower = name.toLowerCase();
        if (lower === "sp") return BigInt(emu.sp);
        if (lower === "pc") return BigInt(emu.pc);
        const m = lower.match(/^[xw](\d+)$/);
        if (!m) return null;
        const idx = Number(m[1]);
        if (idx < 0 || idx > 30) return null;
        const raw = emu.registers[idx];
        if (!raw) return null;
        return BigInt(raw);
      },
      readRegisters: () => {
        const out: Record<string, bigint> = {};
        emu.registers.forEach((v, i) => {
          out[`x${i}`] = BigInt(v);
        });
        out.sp = BigInt(emu.sp);
        out.pc = BigInt(emu.pc);
        return out;
      },
      readMemory: async (addr: number, len: number) => emu.getMemory(addr, len),
      pcAddress: () => emu.pc,
      reset: async () => emu.reset(),
    };
  }, [emu, source]);

  if (emu.loadError) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 px-6 text-center">
        <span className="text-sm text-[var(--danger)]">failed to load emulator</span>
        <pre className="text-xs text-[var(--text-secondary)] max-w-xl whitespace-pre-wrap">
          {emu.loadError}
        </pre>
        <span className="text-xs text-[var(--text-secondary)]">
          check the browser console for details, then reload the page
        </span>
      </div>
    );
  }

  if (!emu.isLoaded) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)]">
        loading emulator...
      </div>
    );
  }

  // embed / checker: the shared core plus a minimal control set. Full-only
  // panels (and their code) never load here.
  if (chrome !== "full") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto] md:grid-rows-1 md:grid-cols-[3fr_2fr]">
          <div className="min-h-0 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border)]">
            <Editor
              value={source}
              onChange={readOnly ? () => {} : setSource}
              currentLine={emu.currentLine}
              breakpoints={emu.breakpoints}
              onToggleBreakpoint={emu.toggleBreakpoint}
              assemblyErrors={emu.assemblyErrors}
              onCursorChange={setCursor}
              lineCounts={emu.lineCounts}
            />
          </div>
          <div className="min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto border-b border-[var(--border)]">
              <RegisterPanel
                registers={emu.registers}
                changedRegs={emu.changedRegs}
                sp={emu.sp}
                pc={emu.pc}
                nzcv={emu.nzcv}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ConsolePanel
                stdout={emu.stdout}
                stderr={emu.stderr}
                blocked={emu.blocked}
                exitCode={emu.exitCode}
                vfsFiles={emu.vfsFiles}
                pushStdin={emu.pushStdin}
                uploadVfsFile={emu.uploadVfsFile}
                clearConsole={emu.clearConsole}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)]">
          {showRun && (
            <button
              type="button"
              onClick={() => void runEmbed()}
              disabled={emu.isHalted && !emu.isRunning}
              aria-label="run"
              className="min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              run
            </button>
          )}
          {showReset && (
            <button
              type="button"
              onClick={emu.reset}
              aria-label="reset"
              className="min-h-[44px] px-4 rounded border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              reset
            </button>
          )}
          {chrome === "checker" && showCheck && (
            <button
              type="button"
              onClick={() => onCheck?.(currentState())}
              aria-label="check"
              className="min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              check
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- full chrome: the maximal configuration (the playground) ----
  const editorBlock = (
    <div className="h-full flex flex-col min-h-0">
      <MultiFileTabs
        files={extraFiles}
        activeIndex={activeFile}
        onSelect={setActiveFile}
        onAdd={(name) => {
          const next: SourceFile = { name, body: `// ${name}\n` };
          const idx = extraFiles.length;
          setExtraFiles([...extraFiles, next]);
          setActiveFile(idx);
        }}
        onRemove={(idx) => {
          const next = extraFiles.filter((_, i) => i !== idx);
          setExtraFiles(next);
          if (activeFile === idx) setActiveFile(-1);
          else if (activeFile > idx) setActiveFile(activeFile - 1);
        }}
        onRename={(idx, name) => {
          setExtraFiles(
            extraFiles.map((f, i) => (i === idx ? { ...f, name } : f)),
          );
        }}
      />
      <div className="flex-1 min-h-0">
        <Editor
          value={editorValue}
          onChange={onEditorChange}
          currentLine={isMain ? emu.currentLine : null}
          breakpoints={emu.breakpoints}
          onToggleBreakpoint={emu.toggleBreakpoint}
          assemblyErrors={isMain ? emu.assemblyErrors : []}
          onCursorChange={isMain ? setCursor : undefined}
          lineCounts={isMain ? emu.lineCounts : undefined}
          onFormat={() => {
            if (!isMain) return;
            const next = formatAsm(source);
            if (next !== source) setSource(next);
            toast.show("source formatted");
          }}
        />
      </div>
    </div>
  );

  const disasmBlock = (
    <div className="h-full overflow-auto">
      {emu.instructions.length === 0 ? (
        // Cold load / nothing assembled: the designed first-run hero, not a
        // blank dense IDE. Replaces InstructionView's bare "no program
        // assembled" line with a brief what-this-is / what-to-press lead.
        <FirstRunState onAssemble={assembleWithHistory} />
      ) : (
        <InstructionView
          instructions={emu.instructions}
          pc={emu.pc}
          running={emu.isRunning}
        />
      )}
    </div>
  );

  const regsBlock = (
    <div className="h-full flex flex-col">
      {/* The prominent, always-on CURRENT instruction strip heads the registers
          column -- the beginner's lifeline -- replacing the thin bottom strip. */}
      <CurrentStrip source={source} currentLine={emu.currentLine} />
      <ReplayScrubber
        frames={emu.replayFrames}
        currentStep={emu.stepCount}
        onSeek={emu.seekReplay}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <RegisterPanel
          registers={emu.registers}
          changedRegs={emu.changedRegs}
          sp={emu.sp}
          pc={emu.pc}
          nzcv={emu.nzcv}
        />
      </div>
    </div>
  );

  const memoryBlock = (
    <MemoryPanel getMemory={emu.getMemory} dirtyAddrs={emu.dirtyAddrs} />
  );
  const stackBlock = (
    <StackPanel
      sp={emu.sp}
      getMemory={emu.getMemory}
      fp={fpValue}
      frameSlots={frameSlots}
    />
  );
  const consoleBlock = (
    <ConsolePanel
      stdout={emu.stdout}
      stderr={emu.stderr}
      blocked={emu.blocked}
      exitCode={emu.exitCode}
      vfsFiles={emu.vfsFiles}
      pushStdin={emu.pushStdin}
      uploadVfsFile={emu.uploadVfsFile}
      clearConsole={emu.clearConsole}
    />
  );
  const terminalBlock = (
    <div className="h-full relative">
      <input
        ref={terminalUploadRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const sizeError = checkUploadSize(f.size, MAX_VFS_BYTES, "file");
          if (sizeError) {
            toast.error(sizeError);
            e.target.value = "";
            return;
          }
          f.arrayBuffer().then((buf) => {
            emu.uploadVfsFile(f.name, new Uint8Array(buf));
          });
          e.target.value = "";
        }}
      />
      <TerminalPane
        buildContext={buildTerminalContext}
        onUploadRequest={() => terminalUploadRef.current?.click()}
      />
    </div>
  );
  const watchBlock = (
    <WatchPanel
      registers={emu.registers}
      sp={emu.sp}
      pc={emu.pc}
      frameSlots={frameSlots}
      getMemory={emu.getMemory}
    />
  );
  const memWatchBlock = <MemoryWatches getMemory={emu.getMemory} />;
  const savesBlock = (
    <SavesPanel
      savedStates={emu.savedStates}
      onSaveState={emu.saveState}
      onLoadState={emu.loadState}
      onDeleteState={emu.deleteState}
      source={source}
      args={argsText}
      stepCount={emu.stepCount}
      onLoadSource={loadSource}
      onSetArgs={setArgsText}
      onRestoreBookmark={emu.restoreBookmark}
    />
  );

  const rightTabs = (
    <div className="h-full flex flex-col">
      <div
        className="flex flex-wrap border-b border-[var(--border)] bg-[var(--bg-sunken)] overflow-x-auto"
        role="tablist"
        aria-label="debug view"
      >
        {(["memory", "stack", "console", "term", "watches", "memwatch", "saves"] as const).map((tab) => {
          const selected = activeTab === tab;
          const showDot = tab === "console" && emu.blocked && !selected;
          return (
            <button
              key={tab}
              id={`right-tab-${tab}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`right-panel-${tab}`}
              className={`relative min-h-[2.25rem] px-4 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
                selected
                  ? "text-[var(--cyan)] border-b border-[var(--cyan)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {showDot && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--cyan)]"
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        className="flex-1 min-h-0 overflow-hidden"
        role="tabpanel"
        id={`right-panel-${activeTab}`}
        aria-labelledby={`right-tab-${activeTab}`}
      >
        {activeTab === "memory" && (
          <div className="h-full overflow-auto">{memoryBlock}</div>
        )}
        {activeTab === "stack" && (
          <div className="h-full overflow-auto">{stackBlock}</div>
        )}
        {activeTab === "console" && (
          <div className="h-full flex flex-col">{consoleBlock}</div>
        )}
        {activeTab === "term" && <div className="h-full">{terminalBlock}</div>}
        {activeTab === "watches" && (
          <div className="h-full overflow-auto">{watchBlock}</div>
        )}
        {activeTab === "memwatch" && (
          <div className="h-full overflow-auto">{memWatchBlock}</div>
        )}
        {activeTab === "saves" && (
          <div className="h-full overflow-auto">{savesBlock}</div>
        )}
      </div>
    </div>
  );

  const showResizable = isAtLeast(bp, "lg");
  const showTablet = !showResizable && isAtLeast(bp, "md");

  return (
    <>
      <div className="safe-area-top flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-sunken)]">
        <span className="hidden sm:inline font-serif text-[15px] font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0">
          cpsc 355 playground
        </span>
        <div className="min-w-0 shrink-0 overflow-hidden">
          <ExampleLoader
            onLoad={(src, label) => loadSource(src, label ?? "example")}
          />
        </div>
        <ImportExport source={source} target={importTarget} onImport={handleImport} />
        <RecentPrograms
          entries={recent.entries}
          onLoad={(body) => loadSource(body)}
          onClear={recent.clear}
        />
        <ArgsInput source={source} value={argsText} onChange={setArgsText} />
        <Toolbar
          className="ml-auto"
          cpsc355Enabled={cpsc.enabled}
          onToggleCpsc355={cpsc.toggle}
          lectureEnabled={lecture.enabled}
          onToggleLecture={lecture.toggle}
          hotspotEnabled={hotspot.enabled}
          onToggleHotspot={hotspot.toggle}
          onShare={() => onOpenShareDialog?.()}
          onTour={() => setTutorialOpen(true)}
          onToggleTheme={() => onToggleTheme?.()}
          buildDiagnostic={() => ({
            source,
            args: argsText || undefined,
            stdin: undefined,
            stdout: emu.stdout || undefined,
            stderr: emu.stderr || undefined,
            exitCode: emu.exitCode,
            registers: emu.registers,
            sp: emu.sp,
            pc: `0x${emu.pc.toString(16).padStart(16, "0")}`,
            stackBytes: (() => {
              const spNum = Number(BigInt(emu.sp));
              if (!Number.isFinite(spNum)) return undefined;
              const top = emu.getMemory(spNum, 64);
              if (!top.length) return undefined;
              return Array.from(top)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(" ");
            })(),
            error: emu.error,
          })}
          onOpenCommandPalette={() => onOpenCommandPalette?.()}
          sourceLink={
            <a
              href="https://github.com/Abdalla-Eldoumani/aarch64-playground"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center min-h-[36px] rounded-[var(--radius-control)] px-2.5 text-[12px] font-sans text-[var(--text-secondary)] hover:text-[var(--cyan)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
              aria-label="View source on GitHub"
            >
              source
            </a>
          }
        />
        <button
          type="button"
          onClick={() => onOpenShortcutsHelp?.()}
          className="shrink-0 inline-flex items-center min-h-[36px] text-xs text-[var(--text-secondary)] hover:text-[var(--cyan)] rounded px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          aria-label="keyboard shortcuts"
        >
          ?
        </button>
      </div>

      {shareBanner && (
        <div
          role="status"
          className="px-4 py-1 text-[11px] text-[var(--cyan)] border-b border-[var(--border)] bg-[var(--bg-sunken)] flex items-center justify-between"
        >
          <span>loaded a shared program from the URL</span>
          <button
            type="button"
            onClick={() => setShareBanner(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] px-1"
          >
            dismiss
          </button>
        </div>
      )}

      <main role="main" aria-label="cpsc 355 playground" className="flex-1 min-h-0 flex flex-col">
        {showResizable ? (
          <ResizableLayout
            breakpoint={bp}
            editor={editorBlock}
            disassembly={disasmBlock}
            registers={regsBlock}
            rightTabs={rightTabs}
          />
        ) : showTablet ? (
          <div className="flex flex-row h-full">
            <div className="flex flex-col w-1/2 border-r border-[var(--border)] min-h-0">
              <div className="flex-1 min-h-0 flex flex-col">{editorBlock}</div>
              <div className="h-40 border-t border-[var(--border)] overflow-auto">
                {disasmBlock}
              </div>
            </div>
            <div className="flex flex-col w-1/2 min-h-0">
              <div className="flex-1 min-h-0 overflow-auto border-b border-[var(--border)]">
                {regsBlock}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">{rightTabs}</div>
            </div>
          </div>
        ) : (
          <MobileLayout
            editor={editorBlock}
            disassembly={disasmBlock}
            registers={regsBlock}
            memory={memoryBlock}
            stack={stackBlock}
            console={consoleBlock}
            terminal={terminalBlock}
            watches={watchBlock}
            memwatch={memWatchBlock}
            saves={savesBlock}
            consoleBlocked={emu.blocked}
          />
        )}
      </main>

      {lecture.enabled && (
        <LectureBar
          onStep={emu.step}
          onReset={emu.reset}
          stepCount={emu.stepCount}
          isHalted={emu.isHalted}
        />
      )}
      <Controls
        onAssemble={assembleWithHistory}
        onStep={emu.step}
        onStepBack={emu.stepBack}
        canStepBack={emu.canStepBack}
        onRun={emu.run}
        onPause={emu.pause}
        onReset={emu.reset}
        isRunning={emu.isRunning}
        isHalted={emu.isHalted}
        error={emu.error}
        stepCount={emu.stepCount}
      />

      <TutorialRunner
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onLoadSnippet={(src, label, args, stdin) => {
          loadSource(src, label);
          if (args !== undefined) setArgsText(args);
          if (stdin !== undefined) emu.pushStdin(stdin);
          setTutorialOpen(false);
        }}
        getRegister={(name) => {
          const lower = name.toLowerCase();
          if (lower === "sp") return emu.sp;
          if (lower === "pc") return String(emu.pc);
          const m = lower.match(/^[xw](\d+)$/);
          if (!m) return null;
          const idx = Number(m[1]);
          if (idx < 0 || idx > 30) return null;
          return emu.registers[idx] ?? null;
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Outer component: owns the lazy-engage gate and the imperative handle, and
// hosts the data-embed wrapper. The hub does not exist until `engaged`.
// ---------------------------------------------------------------------------

export const EmbeddablePlayground = forwardRef<
  EmbeddablePlaygroundHandle,
  EmbeddablePlaygroundProps
>(function EmbeddablePlayground(props, ref) {
  const { chrome, startSource, startArgs, className } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Full chrome is the primary in-viewport content, so it engages on mount,
  // preserving the loading -> ready flow. Embed/checker defer to the lazy
  // trigger effect below so a multi-embed page does not spin up N workers.
  const [engaged, setEngaged] = useState(() => chrome === "full");

  const innerHandleRef = useRef<EmbeddablePlaygroundHandle | null>(null);
  const pendingRef = useRef<Array<(handle: EmbeddablePlaygroundHandle) => void>>([]);

  const registerHandle = useCallback(
    (handle: EmbeddablePlaygroundHandle | null) => {
      innerHandleRef.current = handle;
      if (handle && pendingRef.current.length > 0) {
        const queued = pendingRef.current;
        pendingRef.current = [];
        for (const apply of queued) apply(handle);
      }
    },
    [],
  );

  // An action that arrives before the hub is engaged engages it first and
  // replays once the inner core registers its handle.
  const runOrQueue = useCallback(
    (apply: (handle: EmbeddablePlaygroundHandle) => void) => {
      const handle = innerHandleRef.current;
      if (handle) {
        apply(handle);
        return;
      }
      pendingRef.current.push(apply);
      setEngaged(true);
    },
    [],
  );

  useEffect(() => {
    if (engaged) return;
    const node = wrapperRef.current;
    if (!node) return;

    const engage = () => setEngaged(true);
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) engage();
      });
      observer.observe(node);
    }
    node.addEventListener("mousedown", engage, { once: true });
    node.addEventListener("touchstart", engage, { once: true });
    node.addEventListener("keydown", engage, { once: true });
    node.addEventListener("focusin", engage, { once: true });
    return () => {
      observer?.disconnect();
      node.removeEventListener("mousedown", engage);
      node.removeEventListener("touchstart", engage);
      node.removeEventListener("keydown", engage);
      node.removeEventListener("focusin", engage);
    };
  }, [engaged]);

  useImperativeHandle(
    ref,
    () => ({
      assemble: () => runOrQueue((handle) => handle.assemble()),
      run: () => runOrQueue((handle) => handle.run()),
      pause: () => runOrQueue((handle) => handle.pause()),
      step: () => runOrQueue((handle) => handle.step()),
      stepBack: () => runOrQueue((handle) => handle.stepBack()),
      reset: () => runOrQueue((handle) => handle.reset()),
      loadSource: (next: string, label?: string) =>
        runOrQueue((handle) => handle.loadSource(next, label)),
      getSource: () => innerHandleRef.current?.getSource() ?? startSource ?? "",
      getArgs: () => innerHandleRef.current?.getArgs() ?? startArgs ?? "",
      getCursor: () =>
        innerHandleRef.current?.getCursor() ?? { line: 1, column: 1 },
      getCommands: () => innerHandleRef.current?.getCommands() ?? [],
    }),
    [runOrQueue, startSource, startArgs],
  );

  // data-embed marks the wrapper in embed mode as a host-facing hook so a
  // parent page or iframe can detect and style the embedded surface. The
  // reduced chrome itself is selected by the chrome prop, not this attribute.
  return (
    <div
      ref={wrapperRef}
      data-embed={chrome === "embed" ? "1" : undefined}
      className={joinClasses("flex flex-col flex-1 min-h-0", className)}
    >
      {engaged ? (
        <EmbeddableCore {...props} registerHandle={registerHandle} />
      ) : (
        <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)] text-sm">
          loading editor...
        </div>
      )}
    </div>
  );
});
