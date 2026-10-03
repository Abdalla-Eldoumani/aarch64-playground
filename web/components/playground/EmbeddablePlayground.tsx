"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { IDLE_CPU_VIEW } from "@/lib/emulator/use-cpu-view";
import type { RegView } from "@/lib/emulator/emulator-state";
import type { HandoffPayload } from "@/lib/playground/playground-handoff";
import type { WalkCommand, WalkState } from "@/lib/playground/use-autoplay";
import type { Action } from "@/lib/playground/commands";
import { StaticCodeView } from "@/components/playground/StaticCodeView";
import { RegisterPanel } from "@/components/panels/RegisterPanel";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import { EmbedLayout } from "@/components/playground/EmbedLayout";
import type { SourceFile } from "@/components/playground/MultiFileTabs";
import { EmbeddableCore, type FirstPress } from "@/components/playground/EmbeddableCore";

/**
 * One emulator surface for the playground, the landing hero, lessons, and
 * exercises. Its inner core, EmbeddableCore, owns the `useEmulator()` hub
 * and renders the panels; the hub crosses one boundary only, into
 * FullChromeSurface. `chrome` picks which controls and panels show.
 */
export type EmbeddableChrome = "full" | "embed" | "checker";

/**
 * The ten machine fields a host reads, for its own output and for the
 * practice checker. Defined once here; consumers import it.
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
  /** Ctrl+Enter: assemble the workspace, then run it if that succeeded. */
  assembleAndRun(): void;
  run(): void;
  pause(): void;
  step(): void;
  stepBack(): void;
  reset(): void;
  /** Swap the editor text only (an exercise's restore-starter); a new
   *  program goes through loadProgram so the last run's state is cleared. */
  loadSource(source: string, label?: string): void;
  /** Deliver a complete program handoff (example, share link, bundle):
   *  preserves the replaced buffer in recents, resets the machine, then
   *  applies source, args, cursor, and the stdin/vfs input seeds. */
  loadProgram(payload: HandoffPayload): void;
  getSource(): string;
  getFiles(): SourceFile[];
  getArgs(): string;
  getCursor(): { line: number; column: number };
  /** The command Action[] built inside the component so a host-rendered
   *  palette has no duplicate logic. */
  getCommands(): Action[];
  /** F9 outside the editor: set or clear a breakpoint on main.asm's caret
   *  line. Inside the editor, the editor's own F9 takes the key. */
  toggleBreakpoint(): void;
  /** Surface a host-page failure (bad share link, failed example fetch) through
   *  this component's toast instance. The page entry's own react-hot-toast
   *  binding is a separate module instance in the production chunk graph, so
   *  toasts dispatched there never reach the mounted Toaster; this component's
   *  binding reaches it. */
  notifyError(message: string): void;
  /** The landing hero's walk: pause, resume, replay, or (under reduced
   *  motion) take one step. A no-op on every surface without autoplay. */
  walk(command: WalkCommand): void;
};

export type EmbeddablePlaygroundProps = {
  chrome: EmbeddableChrome;
  startSource?: string;
  /** Extra files a share-link boot carried. Defined (even empty) means
   *  "replace the persisted files strip"; undefined leaves it alone. */
  startFiles?: SourceFile[];
  startArgs?: string;
  startStdin?: string;
  startCursor?: { line: number; column: number };
  /** The host knows a program arrived from a share link; drives the banner. */
  fromShare?: boolean;
  /** Hero = read-only; lessons and exercises editable. */
  readOnly?: boolean;
  /** Embed and checker only: show the program in StaticCodeView instead of
   *  Monaco, so the code is in the server HTML and the landing hero never
   *  loads the editor. The view takes no input, so pass `readOnly` too. */
  staticEditor?: boolean;
  /** Embed chrome: the register file the host's program writes (the reference
   *  bench knows it). Given, the registers panel carries the d and v views and
   *  opens on this one; left out, it shows the x registers alone. */
  registerView?: RegView;
  /** Embed chrome: the registers panel's heading level, one below the host's
   *  section heading (a lesson or reference entry passes 3, a pitfall card 4).
   *  Defaults to 2. */
  registerHeadingLevel?: 2 | 3 | 4;
  /** Landing hero only: once the hub engages, assemble the start program and
   *  step it on a timer with no user action. Off by default, so full and
   *  checker chrome are unchanged. Under prefers-reduced-motion it waits for
   *  the handle's `walk("step")` instead. */
  autoplay?: boolean;
  /** How many steps the autoplay walk takes (clamped to a small ceiling). */
  autoplaySteps?: number;
  /** Told each time the autoplay walk's state changes, so the host can label
   *  its pause and replay control. */
  onAutoplayChange?: (state: WalkState) => void;
  showRun?: boolean;
  showReset?: boolean;
  /** Embed/checker step and back. On by default; the hero's autoplay frame
   *  opts out so the demo stays a two-button surface. */
  showStep?: boolean;
  showBack?: boolean;
  /** Check only applies in checker chrome. */
  showCheck?: boolean;
  /** Embed/checker only: an args box in the control band, seeded from
   *  `startArgs`, for a program that reads its command line. Run and step
   *  use what it holds; Check always uses `startArgs`. */
  showArgs?: boolean;
  onStateChange?: (state: EmbeddableState) => void;
  /** Every editor buffer value, including the first. The practice checker
   *  persists the student's work from here; nothing else listens. */
  onSourceChange?: (source: string) => void;
  /** Checker's Check button: gets the machine state after a run of the
   *  current source. */
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

// What names a control across the swap from the pre-engage panes to the live
// ones: its accessible label, a field's <label> text, or a plain button's text.
function focusKey(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const label = target.getAttribute("aria-label");
  if (label !== null) return label;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.labels?.[0]?.textContent?.trim() || null;
  }
  return target.tagName === "BUTTON" ? target.textContent?.trim() || null : null;
}

// Frozen empties for the pre-engage panes, at module scope so the pre-engage
// render hands the panels the same objects every time and never remounts them
// on a parent re-render.
const NO_CHANGED_REGS: Set<number> = new Set();

// The status line of a frame nobody has pressed yet.
const IDLE_RUN_STATUS = {
  programLoaded: false,
  isRunning: false,
  isHalted: false,
  blocked: false,
  exitCode: null,
  stepCount: 0,
  failed: false,
  registers: IDLE_CPU_VIEW.registers,
  sp: IDLE_CPU_VIEW.sp,
  changedRegs: NO_CHANGED_REGS,
};
const NO_VFS_FILES: string[] = [];

/** The pre-engage controls whose press is an action, not only a wake-up. */
const FIRST_PRESSES: readonly string[] = ["run", "step", "check"];
// ---------------------------------------------------------------------------
// Outer component: owns the lazy-engage gate and the imperative handle, and
// hosts the data-embed wrapper. The hub does not exist until `engaged`.
// ---------------------------------------------------------------------------

export const EmbeddablePlayground = forwardRef<
  EmbeddablePlaygroundHandle,
  EmbeddablePlaygroundProps
>(function EmbeddablePlayground(props, ref) {
  const {
    chrome,
    startSource,
    startArgs,
    className,
    staticEditor,
    registerHeadingLevel,
    showRun = true,
    showReset = true,
    showStep = true,
    showBack = true,
    showCheck = true,
    showArgs = false,
  } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Full chrome is the primary in-viewport content, so it engages on mount,
  // preserving the loading -> ready flow. Embed/checker defer to the lazy
  // trigger effect below so a multi-embed page does not spin up N workers.
  const [engaged, setEngaged] = useState(() => chrome === "full");
  // A click, a tap, a key, or focus is a user asking for the machine now, and
  // so is a press on any pre-engage control.
  const engage = useCallback(() => setEngaged(true), []);
  const [firstPress, setFirstPress] = useState<FirstPress | null>(null);
  const pressFirst = useCallback((press: FirstPress) => {
    setFirstPress(press);
    setEngaged(true);
  }, []);

  // Focus that engages the frame sits on a pre-engage copy of a control, and
  // the swap to the live panes unmounts it, dropping a keyboard or screen
  // reader user back to the page. The same control in the live panes takes
  // the focus back.
  const refocusRef = useRef<string | null>(null);
  useEffect(() => {
    const key = refocusRef.current;
    refocusRef.current = null;
    const node = wrapperRef.current;
    if (!engaged || key === null || !node || node.contains(document.activeElement)) return;
    // The live copy sits where the pressed one did, so the page never needs
    // to move for it.
    Array.from(node.querySelectorAll<HTMLElement>("[aria-label], button, input, textarea"))
      .find((el) => focusKey(el) === key)
      ?.focus({ preventScroll: true });
  }, [engaged]);

  // An autoplay frame keeps its scroll boxes out of the reader's way until the
  // reader reaches in with a click, a tap, or focus (globals.css,
  // data-hands-off). A swipe or a wheel turn over the frame fires no click.
  const [readerIn, setReaderIn] = useState(false);
  const handsOff = Boolean(props.autoplay) && !readerIn;
  useEffect(() => {
    const node = wrapperRef.current;
    if (!handsOff || !node) return;
    const reachIn = () => setReaderIn(true);
    node.addEventListener("click", reachIn);
    node.addEventListener("focusin", reachIn);
    return () => {
      node.removeEventListener("click", reachIn);
      node.removeEventListener("focusin", reachIn);
    };
  }, [handsOff]);

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

    // Coming into view is not a user asking. On the landing the observer fires
    // the moment the tree hydrates, and mounting the core plus its module
    // worker in that same commit lands inside the hydration long task; one
    // idle slot moves it clear, and the timeout bounds the wait so a busy
    // thread cannot leave the hero dead.
    let idleHandle: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const engageWhenIdle = () => {
      // The observer reports every intersection change, not just the first.
      if (idleHandle !== null || idleTimer !== null) return;
      if (typeof requestIdleCallback === "function") {
        idleHandle = requestIdleCallback(engage, { timeout: 1200 });
      } else {
        idleTimer = setTimeout(engage, 0);
      }
    };
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) engageWhenIdle();
      });
      observer.observe(node);
    }
    const engageOnFocus = (event: FocusEvent) => {
      refocusRef.current = focusKey(event.target);
      engage();
    };
    // The press itself engages, so the button it landed on is gone before
    // its click: read which one it was here.
    const engageOnPress = (event: Event) => {
      const label =
        event.target instanceof Element
          ? event.target.closest("button")?.getAttribute("aria-label")
          : null;
      if (label && FIRST_PRESSES.includes(label)) setFirstPress(label as FirstPress);
      engage();
    };
    node.addEventListener("mousedown", engageOnPress, { once: true });
    node.addEventListener("touchstart", engageOnPress, { once: true });
    node.addEventListener("keydown", engage, { once: true });
    node.addEventListener("focusin", engageOnFocus, { once: true });
    return () => {
      observer?.disconnect();
      // A callback that survives the unmount would setEngaged on a gone tree.
      if (idleHandle !== null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleHandle);
      }
      if (idleTimer !== null) clearTimeout(idleTimer);
      node.removeEventListener("mousedown", engageOnPress);
      node.removeEventListener("touchstart", engageOnPress);
      node.removeEventListener("keydown", engage);
      node.removeEventListener("focusin", engageOnFocus);
    };
  }, [engaged, engage]);

  useImperativeHandle(
    ref,
    () => ({
      assemble: () => runOrQueue((handle) => handle.assemble()),
      assembleAndRun: () => runOrQueue((handle) => handle.assembleAndRun()),
      run: () => runOrQueue((handle) => handle.run()),
      pause: () => runOrQueue((handle) => handle.pause()),
      step: () => runOrQueue((handle) => handle.step()),
      stepBack: () => runOrQueue((handle) => handle.stepBack()),
      reset: () => runOrQueue((handle) => handle.reset()),
      loadSource: (next: string, label?: string) =>
        runOrQueue((handle) => handle.loadSource(next, label)),
      loadProgram: (payload: HandoffPayload) =>
        runOrQueue((handle) => handle.loadProgram(payload)),
      notifyError: (message: string) =>
        runOrQueue((handle) => handle.notifyError(message)),
      getSource: () => innerHandleRef.current?.getSource() ?? startSource ?? "",
      getFiles: () => innerHandleRef.current?.getFiles() ?? [],
      getArgs: () => innerHandleRef.current?.getArgs() ?? startArgs ?? "",
      getCursor: () =>
        innerHandleRef.current?.getCursor() ?? { line: 1, column: 1 },
      getCommands: () => innerHandleRef.current?.getCommands() ?? [],
      toggleBreakpoint: () => innerHandleRef.current?.toggleBreakpoint(),
      walk: (command: WalkCommand) => runOrQueue((handle) => handle.walk(command)),
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
      data-hands-off={handsOff || undefined}
      className={joinClasses("flex flex-col flex-1 min-h-0", className)}
    >
      {engaged ? (
        <EmbeddableCore
          {...props}
          registerHandle={registerHandle}
          frameRef={wrapperRef}
          firstPress={firstPress}
        />
      ) : (
        // Embed and checker only. It paints the same grid the engaged render
        // does, so the host page does not shift when the hub arrives, and a
        // static-editor embed draws its real program so the code is in the
        // server HTML. Its controls engage the hub.
        <EmbedLayout
          showRun={showRun}
          showReset={showReset}
          showStep={showStep}
          showBack={showBack}
          showCheck={chrome === "checker" && showCheck}
          args={showArgs ? { value: startArgs ?? "", onChange: engage } : undefined}
          isRunning={false}
          canStep
          canStepBack={false}
          error={null}
          onRun={() => pressFirst("run")}
          onReset={engage}
          onStep={() => pressFirst("step")}
          onStepBack={engage}
          onCheck={() => pressFirst("check")}
          runStatus={IDLE_RUN_STATUS}
          hasOutput={false}
          editor={
            staticEditor && startSource !== undefined ? (
              <StaticCodeView value={startSource} currentLine={null} />
            ) : (
              <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)] text-sm">
                loading editor...
              </div>
            )
          }
          registers={
            <RegisterPanel
              registers={IDLE_CPU_VIEW.registers}
              changedRegs={NO_CHANGED_REGS}
              sp={IDLE_CPU_VIEW.sp}
              pc={IDLE_CPU_VIEW.pc}
              nzcv={IDLE_CPU_VIEW.nzcv}
              headingLevel={registerHeadingLevel}
            />
          }
          console={
            <ConsolePanel
              stdout=""
              stderr=""
              blocked={false}
              exitCode={null}
              vfsFiles={NO_VFS_FILES}
              pushStdin={engage}
              echoStdin={chrome !== "checker"}
              keyHints={false}
              stepButton={showStep}
              closeStdin={engage}
              uploadVfsFile={engage}
              clearConsole={engage}
            />
          }
        />
      )}
    </div>
  );
});
