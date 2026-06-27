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
import { useEmulator } from "@/lib/use-emulator";
import { Editor } from "@/components/Editor";
import { RegisterPanel } from "@/components/RegisterPanel";
import { ConsolePanel } from "@/components/ConsolePanel";
import { Controls } from "@/components/Controls";
import { parseArgs } from "@/lib/args";
import type { Action } from "@/lib/commands";

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
 * The outcome slice the host reads for in-place output and the Phase 5-7
 * checker. Exactly these ten fields mirror the hub; this is the single
 * definition consumers import (no redeclaration elsewhere).
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
  /** Hero = non-editable taste; lessons / exercises editable. */
  readOnly?: boolean;
  /** Optional overrides on top of the chrome defaults. */
  panels?: Partial<Record<PanelKey, boolean>>;
  showRun?: boolean;
  showReset?: boolean;
  /** Check only applies in checker chrome. */
  showCheck?: boolean;
  onStateChange?: (state: EmbeddableState) => void;
  /** Checker Check button; evaluation itself lands in Phase 6. */
  onCheck?: (state: EmbeddableState) => void;
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
  readOnly,
  showRun = true,
  showReset = true,
  showCheck = true,
  onStateChange,
  onCheck,
  registerHandle,
}: EmbeddableCoreProps) {
  const emu = useEmulator();

  const [source, setSource] = useState(startSource ?? "");
  const [argsText] = useState(startArgs ?? "");
  const [cursor, setCursor] = useState<{ line: number; column: number }>({
    line: 1,
    column: 1,
  });

  // Latest-value refs so the imperative handle stays a stable object while
  // still reading live editor/hub state when the host calls a method. The
  // refs are synced in an effect; the new react-hooks rules forbid writing a
  // ref during render.
  const emuRef = useRef(emu);
  const sourceRef = useRef(source);
  const argsRef = useRef(argsText);
  const cursorRef = useRef(cursor);
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    emuRef.current = emu;
    sourceRef.current = source;
    argsRef.current = argsText;
    cursorRef.current = cursor;
    onStateChangeRef.current = onStateChange;
  }, [emu, source, argsText, cursor, onStateChange]);

  const assemble = useCallback(() => {
    emuRef.current.assemble(sourceRef.current, parseArgs(argsRef.current));
  }, []);
  const loadSource = useCallback((next: string) => setSource(next), []);

  // The full action list moves here in the composition pass; the handle
  // contract already exposes it so the host-rendered palette can consume it.
  const buildCommands = useCallback((): Action[] => [], []);

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
  // the object never needs to be rebuilt as state changes.
  const handle = useMemo<EmbeddablePlaygroundHandle>(
    () => ({
      assemble,
      run: () => emuRef.current.run(),
      pause: () => emuRef.current.pause(),
      step: () => emuRef.current.step(),
      stepBack: () => emuRef.current.stepBack(),
      reset: () => emuRef.current.reset(),
      loadSource,
      getSource: () => sourceRef.current,
      getArgs: () => argsRef.current,
      getCursor: () => cursorRef.current,
      getCommands: () => buildCommands(),
    }),
    [assemble, loadSource, buildCommands],
  );

  // Register the handle only once the hub is loaded, so a queued host action
  // (flushed by the outer component on registration) lands on a live backend.
  useEffect(() => {
    if (!emu.isLoaded) return;
    registerHandle(handle);
    return () => registerHandle(null);
  }, [emu.isLoaded, handle, registerHandle]);

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

  const editorPane = (
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
  );

  const registerPane = (
    <RegisterPanel
      registers={emu.registers}
      changedRegs={emu.changedRegs}
      sp={emu.sp}
      pc={emu.pc}
      nzcv={emu.nzcv}
    />
  );

  const consolePane = (
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

  // The composition pass swaps this for the full toolbar/header/layouts; the
  // core panels above are shared by every chrome level.
  if (chrome === "full") {
    return (
      <>
        <main
          role="main"
          aria-label="cpsc 355 playground"
          className="flex-1 min-h-0 grid grid-rows-[1fr_auto_auto] lg:grid-rows-1 lg:grid-cols-[3fr_2fr]"
        >
          <div className="min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border)]">
            {editorPane}
          </div>
          <div className="min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto border-b border-[var(--border)]">
              {registerPane}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {consolePane}
            </div>
          </div>
        </main>
        <Controls
          onAssemble={assemble}
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
      </>
    );
  }

  // embed / checker: the shared core plus a minimal control set.
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto] md:grid-rows-1 md:grid-cols-[3fr_2fr]">
        <div className="min-h-0 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border)]">
          {editorPane}
        </div>
        <div className="min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto border-b border-[var(--border)]">
            {registerPane}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {consolePane}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)]">
        {showRun && (
          <button
            type="button"
            onClick={emu.run}
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

  // The full playground is the primary in-viewport content, so it engages
  // immediately, preserving the loading -> ready flow. Embed/checker
  // instances defer until first viewport entry or first interaction so a
  // multi-embed page does not spin up N workers at once (PERF-01).
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
