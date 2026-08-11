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
import { useEmulator } from "@/lib/emulator/use-emulator";
import { useBreakpoint, isAtLeast } from "@/lib/hooks/use-breakpoint";
import { loadAutoSavedBuffer, useAutoSave, useRecentPrograms } from "@/lib/playground/auto-save";
import {
  EXAMPLE_INTERACTIVE,
  decodeLaunch,
  legacyModeArgsFor,
  modeArgsFor,
  type HandoffPayload,
  type LaunchMode,
} from "@/lib/playground/playground-handoff";
import { parseFrameSlots } from "@/lib/emulator/frame-labels";
import { parseArgs } from "@/lib/playground/args";
import { formatAsm } from "@/lib/asm/asm-formatter";
import {
  MAX_VFS_BYTES,
  checkUploadSize,
  validateStdin,
} from "@/lib/playground/upload-guard";
import { loadPersistedVfs, savePersistedVfs } from "@/lib/playground/vfs-persist";
import {
  describeTarget,
  getImportTarget,
  type ImportTarget,
} from "@/lib/hooks/use-import-target";
import type { Action } from "@/lib/playground/commands";
import { Editor } from "@/components/playground/Editor";
import { RegisterPanel } from "@/components/panels/RegisterPanel";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import { Controls } from "@/components/playground/Controls";
import { DecodeStrip } from "@/components/panels/DecodeStrip";
import { FirstRunState } from "@/components/playground/FirstRunState";
import { ExampleLoader } from "@/components/playground/ExampleLoader";
import { RunModeControl } from "@/components/playground/RunModeControl";
import { RecentPrograms } from "@/components/playground/RecentPrograms";
import { ResizableLayout } from "@/components/playground/ResizableLayout";
import { MobileLayout } from "@/components/playground/MobileLayout";
import { ImportExport } from "@/components/playground/ImportExport";
import { Toolbar } from "@/components/playground/Toolbar";
import { ArgsInput } from "@/components/playground/ArgsInput";
import {
  MultiFileTabs,
  combineSources,
  type SourceFile,
} from "@/components/playground/MultiFileTabs";
import { useSourceFiles } from "@/lib/hooks/use-source-files";
import {
  MAIN_FILE,
  combinedLineFor,
  countLines,
  resolveLine,
  validateFileName,
} from "@/lib/playground/file-map";
import { useToast } from "@/components/ui/Toast";

// Persisted beside the files strip so a reloaded workspace remembers which
// surface owns the pane at run press. The key name predates the mode having
// two spellings: it still holds the "1" / "0" a returning student's browser
// wrote, which decodeLaunch reads unchanged.
const LAUNCH_MODE_KEY = "aarch64-playground:terminal-program";

// Full-only / heavy panels load on first render so a multi-embed page (and
// the embed/checker chrome) never ships their code.
const InstructionView = dynamic(
  () => import("@/components/panels/InstructionView").then((m) => m.InstructionView),
  { ssr: false },
);
const MemoryPanel = dynamic(
  () => import("@/components/panels/MemoryPanel").then((m) => m.MemoryPanel),
  { ssr: false },
);
const StackPanel = dynamic(
  () => import("@/components/panels/StackPanel").then((m) => m.StackPanel),
  { ssr: false },
);
const WatchPanel = dynamic(
  () => import("@/components/panels/WatchPanel").then((m) => m.WatchPanel),
  { ssr: false },
);
const MemoryWatches = dynamic(
  () => import("@/components/panels/MemoryWatches").then((m) => m.MemoryWatches),
  { ssr: false },
);
const BaseConverter = dynamic(
  () => import("@/components/panels/BaseConverter").then((m) => m.BaseConverter),
  { ssr: false },
);
const ReplayScrubber = dynamic(
  () => import("@/components/playground/ReplayScrubber").then((m) => m.ReplayScrubber),
  { ssr: false },
);
const SavesPanel = dynamic(
  () => import("@/components/panels/SavesPanel").then((m) => m.SavesPanel),
  { ssr: false },
);
const TerminalPane = dynamic(
  // Named so the bundle budget in package.json can glob xterm's chunk by
  // name; a hashed webpack id moves with any change to the module graph,
  // and the budget that used to point at one silently measured nothing.
  () =>
    import(/* webpackChunkName: "terminal" */ "@/components/panels/TerminalPane").then(
      (m) => m.TerminalPane,
    ),
  { ssr: false, loading: () => null },
);
const TutorialRunner = dynamic(
  () => import("@/components/playground/TutorialRunner").then((m) => m.TutorialRunner),
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
  /** Load a program into the editable buffer (recent / bookmark / tutorial). */
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
  /** Surface a host-page failure (bad share link, failed example fetch)
   *  through this component's toast instance. The page entry's own
   *  react-hot-toast binding is a separate module instance in the
   *  production chunk graph, so toasts dispatched there never reach the
   *  mounted Toaster; this component's binding provably does. */
  notifyError(message: string): void;
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
  /** Hero = non-editable taste; lessons / exercises editable. */
  readOnly?: boolean;
  /** Landing hero only: once the hub engages, assemble the start program and
   *  step it on a timer with no user action. Off by default, so full and
   *  checker chrome are unchanged. Suppressed under prefers-reduced-motion. */
  autoplay?: boolean;
  /** How many steps the autoplay walk takes (clamped to a small ceiling). */
  autoplaySteps?: number;
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

// One naming rule for every recents entry: the program's first comment
// line, or a timestamped snippet label when it has none.
function nameForRecents(source: string): string {
  const firstComment = source
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("//") || l.startsWith(";"));
  return firstComment
    ? firstComment.replace(/^(?:\/\/|;)\s*/, "").slice(0, 48)
    : `snippet ${new Date().toLocaleTimeString()}`;
}

// Autoplay cadence for the landing hero: a short step interval so the register
// flash and the pc marker read clearly, and a hard ceiling so the walk stays
// bounded regardless of the host-supplied step count.
const AUTOPLAY_STEP_MS = 450;
const AUTOPLAY_MAX_STEPS = 10;

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
  startFiles,
  startArgs,
  startStdin,
  startCursor,
  fromShare,
  readOnly,
  autoplay,
  autoplaySteps = 8,
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
  // Advisory pre-assembly lint: frame-balance and m4-hygiene warnings,
  // refreshed shortly after the student stops typing. Warnings, never
  // errors -- assembling stays available regardless.
  const [lintWarnings, setLintWarnings] = useState<
    Array<{ line: number; message: string }>
  >([]);
  const [activeTab, setActiveTab] = useState<
    "memory" | "stack" | "console" | "term" | "watches" | "convert" | "memwatch" | "saves"
  >("memory");
  // Mirrors the palette's converter action into the phone layout, where the
  // desktop tab state has nothing to show.
  const [paneRequest, setPaneRequest] = useState<{ pane: string; nonce: number } | null>(null);
  const [argsText, setArgsText] = useState(startArgs ?? "");
  const [shareBanner, setShareBanner] = useState(Boolean(fromShare));
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [cursor, setCursor] = useState<{ line: number; column: number }>(
    startCursor ?? { line: 1, column: 1 },
  );
  const [extraFiles, setExtraFiles, filesBackup] = useSourceFiles();
  const [activeFile, setActiveFile] = useState<number>(-1);
  // The workspace as the machine last saw it. Every combined-string line the
  // MACHINE produces -- the current-line marker, assembly errors, a runtime
  // fault's line -- is numbered against this, not against whatever the
  // student has typed since. Resolving those against the live buffers made
  // the marker change FILES on an unrelated edit, and let an error land in
  // the wrong tab while its own assemble was still in flight.
  const [assembledLayout, setAssembledLayout] = useState<{
    main: string;
    extras: SourceFile[];
  } | null>(null);
  // Who owns the pane when this program's run is pressed: a live terminal
  // session (the visualizer example, or the student's own choice) or the
  // classic console flow. Persisted beside the files strip so a reloaded
  // workspace keeps the takeover.
  const [launchMode, setLaunchModeState] = useState<LaunchMode>(() => {
    if (typeof window === "undefined") return "console";
    try {
      return decodeLaunch(window.localStorage.getItem(LAUNCH_MODE_KEY));
    } catch {
      return "console";
    }
  });
  // Read by the blocked-jump effect, which must not re-subscribe.
  const launchModeRef = useRef<LaunchMode>("console");
  const setLaunchMode = useCallback((next: LaunchMode) => {
    launchModeRef.current = next;
    setLaunchModeState(next);
    try {
      window.localStorage.setItem(LAUNCH_MODE_KEY, next);
    } catch {
      // storage full or blocked; the mode just won't survive a reload
    }
  }, []);
  // The example this workspace came from, when it came from one. The
  // run-mode control is offered for exactly the stems that have a real
  // answer to the question; a hand-written buffer has none, so it stays
  // null and the header band is the one every other program sees.
  const [loadedStem, setLoadedStem] = useState<string | null>(null);
  // The args the loaded payload carried. With the mode's two seeded forms
  // it is the third value that still counts as a clean args box, so a
  // fixture-seeded program keeps following the mode until the student types
  // something of their own.
  const payloadArgsRef = useRef("");
  // The run-mode control moves the args box too, for the examples that wear
  // a different face per surface. It stops at the student: a box edited to
  // anything the app did not put there is theirs, in either mode.
  const handleLaunchModeChange = useCallback(
    (next: LaunchMode) => {
      setLaunchMode(next);
      const seeded = modeArgsFor(loadedStem, next);
      if (seeded == null) return;
      const clean =
        argsText === "" ||
        argsText === modeArgsFor(loadedStem, "console") ||
        argsText === payloadArgsRef.current;
      if (clean) setArgsText(seeded);
    },
    [argsText, loadedStem, setLaunchMode],
  );
  // The console face used to seed `./<stem> console`; the emulator now
  // owns argv[0], so that stored box would hand the program an extra
  // argument and land it on its usage path. Migrate that exact string --
  // whichever ingress restored it -- and leave every other box alone.
  useEffect(() => {
    if (argsText !== "" && argsText === legacyModeArgsFor(loadedStem)) {
      setArgsText(modeArgsFor(loadedStem, "console") ?? "");
    }
  }, [argsText, loadedStem]);
  // A text-only swap or an import replaces the program without a payload:
  // the mode and the stem both belonged to the program that set them, and
  // a stale mode would send an unrelated program's run to the pane.
  const resetLaunch = useCallback(() => {
    setLaunchMode("console");
    setLoadedStem(null);
  }, [setLaunchMode]);
  useEffect(() => {
    launchModeRef.current = launchMode;
  }, [launchMode]);
  // Nonce asking the attach effect to start a terminal-pane run once the
  // pane's io registration lands (the pane mounts lazily on tab switch).
  const [termRunRequest, setTermRunRequest] = useState<number | null>(null);
  // The terminal mounts lazily on first use and then stays mounted (see
  // the tab panel below): a live session must survive tab switches.
  const [termOpened, setTermOpened] = useState(false);
  useEffect(() => {
    if (activeTab === "term") setTermOpened(true);
  }, [activeTab]);

  // A share-link boot carries its own workspace: replace the persisted
  // files strip once, before the first assemble can mix the two.
  const startFilesApplied = useRef(false);
  useEffect(() => {
    if (startFiles === undefined || startFilesApplied.current) return;
    startFilesApplied.current = true;
    setExtraFiles(startFiles);
  }, [startFiles, setExtraFiles]);

  // Jump-to-error: when an assemble or a line-carrying runtime fault
  // lands, the editor switches to the owning file, then reveals and
  // focuses the offending line. Nonce so the same line re-fires when the
  // student re-assembles unchanged. Combined-string lines resolve through
  // the file map so an error inside an extra file lands in that tab, not
  // past the end of main.asm.
  const [errorFocus, setErrorFocus] = useState<{ line: number; nonce: number } | null>(null);
  // Read through a ref, not the layout state, so the jump keeps its single
  // dependency on the errors themselves.
  const assembledLayoutRef = useRef<{ main: string; extras: SourceFile[] } | null>(null);
  const pinAssembledLayout = useCallback((main: string, extras: SourceFile[]) => {
    const layout = { main, extras };
    assembledLayoutRef.current = layout;
    setAssembledLayout(layout);
  }, []);
  useEffect(() => {
    const first = emu.assemblyErrors[0];
    if (first && first.line > 0) {
      const pinned = assembledLayoutRef.current;
      const loc = resolveLine(
        first.line,
        pinned?.main ?? sourceRef.current,
        pinned?.extras ?? extraFilesRef.current,
      );
      setActiveFile(loc.file);
      setErrorFocus({ line: loc.line, nonce: Date.now() });
    }
  }, [emu.assemblyErrors]);
  const toast = useToast();
  const importTarget = getImportTarget(activeFile);

  // Replacing the program text drops the launch mode: it belongs to the
  // program that set it, and a stale mode would send an unrelated
  // program's run to the terminal pane.
  const loadSource = useCallback(
    (next: string, _label?: string) => {
      setSource(next);
      resetLaunch();
    },
    [resetLaunch],
  );

  const handleImport = useCallback(
    (target: ImportTarget, body: string) => {
      resetLaunch();
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
    [extraFiles, setExtraFiles, toast, resetLaunch],
  );

  // Multi-select import: a file named main.asm / main.s replaces the main
  // buffer; every other file becomes (or refreshes) a named tab, so a
  // whole multi-file program lands in one gesture.
  const handleImportMany = useCallback(
    (files: { name: string; body: string }[]) => {
      resetLaunch();
      const mainIdx = files.findIndex((f) => /^main\.(asm|s)$/i.test(f.name));
      if (mainIdx >= 0) setSource(files[mainIdx].body);
      const rest = files.filter((_, i) => i !== mainIdx);
      const next = [...extraFiles];
      for (const f of rest) {
        const at = next.findIndex((x) => x.name === f.name);
        if (at >= 0) next[at] = { name: f.name, body: f.body };
        else next.push({ name: f.name, body: f.body });
      }
      setExtraFiles(next);
      toast.show(`imported ${files.length} files`);
    },
    [extraFiles, setExtraFiles, toast, resetLaunch],
  );

  // Only the full playground persists to the shared auto-save buffer; embed
  // and checker surfaces carry host-supplied programs that must not overwrite
  // the user's saved playground work.
  useAutoSave(source, chrome === "full");
  const recent = useRecentPrograms();

  // A boot buffer that arrived through a handoff (a share link or bundle
  // opened in a fresh tab) displaced the autosave before the first
  // debounced write could run; keep that prior work reachable through
  // recents instead of silently overwriting it. On a normal boot the
  // autosave IS the start buffer, so nothing is pushed.
  useEffect(() => {
    if (chrome !== "full") return;
    const prior = loadAutoSavedBuffer();
    if (prior && prior.trim().length > 0 && prior !== (startSource ?? "")) {
      recent.push(nameForRecents(prior), prior);
    }
    // Mount-only: the boot buffer comparison is meaningful exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Input seeds for the current program. Assembling resets the whole
  // machine (stdin queue and VFS included), so the seeds re-apply after
  // every successful assemble; a new handoff replaces them.
  // Full chrome drops stdin seeds the same way `loadProgram` does: a program
  // that reads input should BLOCK at the read and pull the student to the
  // console. Seeding here re-fed the boot's stdin after every assemble, so a
  // hard-loaded share or bundle link answered its own scanf forever while the
  // same link opened by in-app navigation did not.
  const seedsRef = useRef<{ stdin?: string; vfs?: Record<string, string> }>({
    stdin: chrome === "full" ? undefined : startStdin,
  });

  const applySeeds = useCallback(() => {
    const seeds = seedsRef.current;
    if (seeds.stdin) emuRef.current.pushStdin(seeds.stdin);
    if (seeds.vfs) {
      const enc = new TextEncoder();
      for (const [name, body] of Object.entries(seeds.vfs)) {
        emuRef.current.uploadVfsFile(name, enc.encode(body));
      }
    }
  }, []);

  // The working file set is the seeds' vfs map: everything the student put
  // there on purpose (uploads, terminal redirect outputs, a program's loaded
  // fixtures). Routing every user write through these helpers keeps the map
  // authoritative, which buys two behaviors at once: assemble's machine
  // reset re-seeds the files instead of losing them, and the full
  // playground mirrors the map into IndexedDB so it survives reloads and
  // route changes. Embed and checker chromes stay session-only sandboxes.
  const persistWorkingSet = useCallback(() => {
    if (chrome !== "full") return;
    void savePersistedVfs(seedsRef.current.vfs ?? {});
  }, [chrome]);

  const stageVfsFile = useCallback(
    (name: string, data: Uint8Array | string) => {
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const body = typeof data === "string" ? data : new TextDecoder().decode(data);
      seedsRef.current.vfs = { ...(seedsRef.current.vfs ?? {}), [name]: body };
      emuRef.current.uploadVfsFile(name, bytes);
      persistWorkingSet();
    },
    [persistWorkingSet],
  );

  const removeVfsFile = useCallback(
    async (path: string) => {
      if (seedsRef.current.vfs && path in seedsRef.current.vfs) {
        const next = { ...seedsRef.current.vfs };
        delete next[path];
        seedsRef.current.vfs = next;
      }
      const removed = await emuRef.current.deleteVfsFile(path);
      persistWorkingSet();
      return removed;
    },
    [persistWorkingSet],
  );

  const loadProgram = useCallback(
    (payload: HandoffPayload) => {
      // The replaced buffer stays recoverable through recents; entries are
      // keyed by content hash there, so repeats do not stack up.
      const prev = sourceRef.current;
      if (chrome === "full" && prev.trim().length > 0 && prev !== payload.source) {
        recent.push(nameForRecents(prev), prev);
      }
      // A fresh program starts on a fresh machine: registers, memory,
      // console, exit code, stdin queue, and VFS all clear. Breakpoints
      // too -- reset deliberately keeps them for the SAME program, but a
      // different program must not inherit another's gutter dots and CPU
      // addresses (when the new program is shorter, those addresses were
      // unreachable by any click and only a reload recovered).
      emuRef.current.clearAllBreakpoints();
      emuRef.current.reset();
      // Interactive input is the point in the full playground: a program
      // that reads stdin should block at its scanf and pull the student to
      // the console, so example stdin fixtures do not pre-seed there. The
      // embed and checker chromes keep authored seeds (lesson figures and
      // exercise checks must run exactly as written), and VFS fixtures
      // always seed -- the file examples need their inputs on disk.
      // Full chrome treats the VFS as the student's home directory: a new
      // program's fixtures land beside (and on name collisions, over) the
      // files already there, never wiping them. Embed and checker keep the
      // strict replace: a lesson figure must see exactly its own fixtures.
      const workingVfs =
        chrome === "full"
          ? { ...(seedsRef.current.vfs ?? {}), ...(payload.vfs ?? {}) }
          : payload.vfs;
      seedsRef.current = {
        stdin: chrome === "full" ? undefined : payload.stdin,
        vfs: workingVfs,
      };
      // Seed the VFS now so the console's file list shows the program's
      // fixtures immediately; assemble re-seeds after its machine reset.
      if (workingVfs) {
        const enc = new TextEncoder();
        for (const [name, body] of Object.entries(workingVfs)) {
          emuRef.current.uploadVfsFile(name, enc.encode(body));
        }
      }
      persistWorkingSet();
      setSource(payload.source);
      // A program handoff replaces the whole workspace: stale helper
      // files from earlier work must not concatenate into the new
      // program at its next assemble.
      setExtraFiles(payload.files ?? []);
      setActiveFile(-1);
      const launch = payload.launch === "terminal" ? "terminal" : "console";
      setLaunchMode(launch);
      setLoadedStem(payload.stem ?? null);
      // A mode-args example wears a different face per surface, so the mode
      // owns its args box: the console face takes the token, the terminal
      // face takes none. That overrides the fixture args the payload
      // carries (temp-convert declares both), and the payload's own value
      // is remembered as one of the forms a still-clean box may hold.
      payloadArgsRef.current = payload.args ?? "";
      setArgsText(modeArgsFor(payload.stem, launch) ?? payloadArgsRef.current);
      setCursor(payload.cursor ?? { line: 1, column: 1 });
      // A new program starts on a fresh console; no session owns it yet.
      setTerminalOwnedFrom(null);
      setShareBanner(Boolean(payload.fromShare));
      lastRunSourceRef.current = null;
    },
    [chrome, recent, persistWorkingSet, setExtraFiles, setLaunchMode],
  );

  // Rehydrate the home directory once the hub is live: the persisted files
  // sit underneath anything a boot handoff (share link, bundle, example)
  // already staged, so a link's fixtures win their name collisions. Runs
  // once per mount; embed and checker chromes never touch the store.
  const hydratedVfsRef = useRef(false);
  useEffect(() => {
    if (chrome !== "full" || hydratedVfsRef.current || !emu.isLoaded) return;
    hydratedVfsRef.current = true;
    void loadPersistedVfs().then((files) => {
      if (!files || Object.keys(files).length === 0) return;
      seedsRef.current.vfs = { ...files, ...(seedsRef.current.vfs ?? {}) };
      const enc = new TextEncoder();
      for (const [name, body] of Object.entries(seedsRef.current.vfs)) {
        emuRef.current.uploadVfsFile(name, enc.encode(body));
      }
    });
  }, [chrome, emu.isLoaded]);

  // Push the current buffer onto the recent list whenever the user
  // assembles, and concatenate any extra files so `bl func` resolves across
  // files (the linker operates on one string). On success, re-apply the
  // program's input seeds: the assemble reset the machine, and the seeded
  // stdin and VFS files must be in place before the run. Returns the
  // verdict so a composite action can stop at a failed assemble; the
  // button and palette callers ignore it.
  const assembleWithHistory = useCallback(async (): Promise<boolean> => {
    // The assemble resets the machine and empties the console, so a
    // previous session's watermark points at bytes that are gone.
    setTerminalOwnedFrom(null);
    const trimmed = source.trim();
    if (trimmed.length > 0) {
      recent.push(nameForRecents(source), source);
    }
    const combined =
      extraFiles.length > 0 ? combineSources(source, extraFiles) : source;
    // Pin the workspace the machine is about to see BEFORE awaiting: every
    // combined line it reports back is numbered against exactly these
    // buffers, however much the student types while the assemble is in
    // flight.
    pinAssembledLayout(source, extraFiles);
    const ok = await emu.assemble(combined, parseArgs(argsText));
    if (ok) applySeeds();
    return ok;
  }, [source, recent, emu, extraFiles, argsText, applySeeds, pinAssembledLayout]);

  // The one-action interactive launch: assemble, then hand the pane over.
  // Reached from the palette's launch action and from a run press in
  // terminal mode with nothing assembled -- the state that used to be a
  // silent no-op. It bypasses handleRun's finished-screen guard on
  // purpose: that guard protects a completed program's output, and this
  // just replaced the program with a freshly assembled one. The order
  // matters -- the assemble must land before the nonce, or the drive's
  // programLoaded standdown tears the session down at once.
  const launchInteractive = useCallback(async () => {
    const ok = await assembleWithHistory();
    // The failure already renders in Controls' error box, and the pane is
    // left alone: a failed assemble must not wipe the terminal.
    if (!ok) return;
    setActiveTab("term");
    setPaneRequest({ pane: "term", nonce: Date.now() });
    setTermRunRequest(Date.now());
  }, [assembleWithHistory]);

  // The reduced embed/checker chrome has no separate Assemble control, so its
  // primary Run must assemble first; otherwise runUntilBreak executes over
  // empty memory and nothing the student wrote runs. Assemble when nothing is
  // loaded yet (fresh or post-reset, instructions empty), the source changed
  // since the last run, or the machine has halted (Run on a finished program
  // means run it again from the start), awaiting the hub so the backend is
  // loaded before run. A failed assemble skips the run, and a successful one
  // re-applies the program's input seeds: the assemble reset the machine, so
  // seeded stdin and VFS files must be back in place before the run. Only a
  // blocked or paused unchanged program resumes without re-assembling.
  const lastRunSourceRef = useRef<string | null>(null);
  const runEmbed = useCallback(async () => {
    if (
      emu.instructions.length === 0 ||
      lastRunSourceRef.current !== source ||
      emu.isHalted
    ) {
      lastRunSourceRef.current = source;
      const ok = await emu.assemble(source, parseArgs(argsText));
      if (!ok) return;
      applySeeds();
    }
    emu.run();
  }, [emu, source, argsText, applySeeds]);

  // Auto-switch to the console on the false->true edge of `blocked` so the
  // student sees the scanf prompt. queueMicrotask defers the flip out of the
  // synchronous render phase. Terminal programs (raw mode) keep their
  // input in the terminal pane, so the console jump stands down for them.
  const lastBlockedRef = useRef(false);
  useEffect(() => {
    if (emu.blocked && !lastBlockedRef.current) {
      lastBlockedRef.current = true;
      if (emu.wantsTerminal) return;
      // A foreground terminal session owns the program's input even
      // without raw mode: a menu program run as `./program` reads its
      // scanf lines from the term pane, so the console jump stands down.
      // A terminal-mode program keeps that ownership for its whole
      // life, including the gap before its drive attaches -- the console
      // must never steal a read it cannot answer.
      if (foregroundActiveRef.current || launchModeRef.current === "terminal") return;
      queueMicrotask(() => {
        setActiveTab("console");
        // Phones route panes through the pane switcher, not the tab state.
        setPaneRequest({ pane: "console", nonce: Date.now() });
      });
    } else if (!emu.blocked) {
      lastBlockedRef.current = false;
    }
  }, [emu.blocked, emu.wantsTerminal]);

  // The terminal pane's interactive I/O surface. State, not a ref: the
  // pane mounts lazily on first tab activation, which happens AFTER a
  // raw-mode program's rising edge switches the tab -- the self-attach
  // effect must re-fire when the registration lands.
  // Live only while this component is mounted: a foreground drive polls
  // on a timer and must not outlive the surface it drives.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Mirrors termIO for the poll loop, which must notice a pane that went
  // away without waiting for a re-render.
  const termIORef = useRef<import("@/lib/terminal/dispatch").TerminalProgramIO | null>(null);
  const [termIO, setTermIO] =
    useState<import("@/lib/terminal/dispatch").TerminalProgramIO | null>(null);
  const foregroundActiveRef = useRef(false);
  // Mirrored as state so the console can render "this program reads from
  // the terminal" and disable its own stdin box while a session owns it.
  const [foregroundLive, setForegroundLive] = useState(false);
  // Where in the console's stdout a terminal-owned session began. The
  // session's output goes to the pane, which is a real terminal; the
  // console is plain text and would render a full-screen program's escape
  // sequences as literal garbage. Null means no session has taken this
  // program over, which is every classic console run.
  const [terminalOwnedFrom, setTerminalOwnedFrom] = useState<number | null>(null);

  // Reset and clear both empty the console, so the watermark they leave
  // behind describes bytes that no longer exist: it goes with them, and the
  // next classic run renders exactly as it always has.
  const resetMachine = useCallback(() => {
    setTerminalOwnedFrom(null);
    emuRef.current.reset();
  }, []);
  const clearConsoleAll = useCallback(() => {
    setTerminalOwnedFrom(null);
    emuRef.current.clearConsole();
  }, []);

  // Hiding the pane blurs its textarea, so coming back to a live session
  // needs the keyboard handed over again -- otherwise the student types
  // into nothing while the console says "type in the terminal".
  useEffect(() => {
    if (activeTab !== "term" || !foregroundLive) return;
    termIORef.current?.focus?.();
  }, [activeTab, foregroundLive]);

  // A program that switches the terminal to raw mode is a terminal
  // program: hand it the terminal pane on the false->true edge, the same
  // way blocked hands scanf programs the console.
  const lastWantsTermRef = useRef(false);
  useEffect(() => {
    if (emu.wantsTerminal && !lastWantsTermRef.current) {
      lastWantsTermRef.current = true;
      // For a raw-mode program this edge IS the session start: the tab
      // switch, the lazy pane mount, and the io registration all take
      // renders, and the program paints full frames through every one of
      // them. Pinning the console's watermark here rather than at the
      // drive's attach is what keeps those frames out of a plain-text
      // scrollback. Earliest pin wins, so the attach leaves it alone.
      setTerminalOwnedFrom((prev) => prev ?? emu.stdout.length);
      queueMicrotask(() => {
        setActiveTab("term");
        setPaneRequest({ pane: "term", nonce: Date.now() });
      });
    } else if (!emu.wantsTerminal) {
      lastWantsTermRef.current = false;
    }
  }, [emu.wantsTerminal, emu.stdout]);

  // The one foreground drive both entry paths share: stream output to
  // the pane, forward its keystrokes to stdin, resume input-starved
  // stops, and stand down on halt, error, cancel, or a user pause.
  const driveForeground = useCallback(
    async (
      io: import("@/lib/terminal/dispatch").TerminalProgramIO,
      opts?: { clearAtStart?: boolean },
    ): Promise<number | null> => {
      if (foregroundActiveRef.current) return null;
      foregroundActiveRef.current = true;
      setForegroundLive(true);
      // Everything from here goes to the pane through the output tap below.
      // Pin where the console's scrollback stops so it can show what
      // printed BEFORE the takeover and one note in place of the rest.
      // A raw-mode program pinned this at its rising edge, several frames
      // ago; the earliest pin of a session wins, so this only fires for a
      // session that starts here (terminal mode's run, `./name`).
      setTerminalOwnedFrom((prev) => prev ?? emuRef.current.stdout.length);
      let cancelled = false;
      // Set once the pane we are driving has registered itself; after that,
      // losing the registration means the pane went away.
      let sawPane = false;
      // Wipe the pane once, the moment the program claims the terminal
      // (already true on self-attach; flips mid-run for ./name), so the
      // takeover starts on a clean screen with no earlier scrollback.
      let cleared = false;
      const clearOnce = () => {
        if (!cleared) {
          cleared = true;
          io.clear?.();
        }
      };
      if (opts?.clearAtStart || emuRef.current.wantsTerminal) clearOnce();
      // Live sessions skip the step-back ring: the per-step clone costs
      // more than the step, and stepping back mid-session has no meaning.
      emuRef.current.setSnapshotsPaused(true);
      emuRef.current.setOutputTap((t) => io.write(t));
      // Cooked-mode input works like a canonical tty: the line buffers
      // locally with echo (so typed digits are visible) and backspace
      // editing, and reaches the program as one line ending in \n on
      // enter. Raw-mode programs (termios) get every byte untouched and
      // draw their own screens.
      let lineBuf = "";
      io.setForeground({
        pushInput: (d) => {
          const e = emuRef.current;
          // Keystrokes arrive one at a time, but a clipboard paste arrives
          // whole and the pane forwards it verbatim. Bound it here, where
          // both tty modes converge, so a pasted megabyte cannot land in
          // the machine's stdin queue in one gesture.
          const oversize = validateStdin(d);
          if (oversize) {
            io.write(`\r\n[${oversize}]\r\n`);
            return;
          }
          if (e.wantsTerminal) {
            e.pushStdin(d);
            return;
          }
          for (let i = 0; i < d.length; i++) {
            const ch = d[i];
            if (ch === "\r" || ch === "\n") {
              io.write("\r\n");
              e.pushStdin(`${lineBuf}\n`);
              lineBuf = "";
            } else if (ch === "\x7f" || ch === "\b") {
              if (lineBuf.length > 0) {
                lineBuf = lineBuf.slice(0, -1);
                io.write("\b \b");
              }
            } else if (ch === "\x1b") {
              // Swallow the rest of an escape sequence (arrow keys):
              // canonical reads have no use for it.
              return;
            } else if (ch >= " ") {
              lineBuf += ch;
              io.write(ch);
            }
          }
        },
        cancel: () => {
          cancelled = true;
          emuRef.current.pause();
        },
      });
      try {
        {
          const e = emuRef.current;
          if (!e.isRunning && !e.isHalted) e.run();
        }
        let resumeArmed = false;
        // The hub's isRunning/blocked arrive through React state, so the
        // first polls after run() can still read the pre-run snapshot.
        // Ending the session there printed "[program stopped]" over a
        // program that was only just starting, and handed its blocked
        // read to the console. Wait for real evidence it began.
        let started = false;
        const openedAt = Date.now();
        for (;;) {
          await new Promise<void>((r) => setTimeout(r, 32));
          // Stand down if this component unmounted (a route change) or
          // the pane we are driving went away (a mobile pane switch
          // unmounts it). Without this the loop spins forever on a
          // blocked program, holding the console's stdin disabled and
          // the snapshot ring paused with no way back.
          if (!mountedRef.current) break;
          // A pane that unmounts deregisters by writing null, so "not this
          // io" has to include null -- the earlier `!== null` clause meant
          // the one case this guard exists for was the one it let through.
          // It stays tolerant only until the pane first registers, since a
          // drive can start a frame before that lands.
          if (termIORef.current === io) sawPane = true;
          else if (sawPane || termIORef.current !== null) break;
          const e = emuRef.current;
          if (e.wantsTerminal) clearOnce();
          if (cancelled || e.isHalted || e.error) break;
          // An assemble or a reset mid-session drops the loaded flag: the
          // program this drive was running no longer exists, and the resume
          // latch below would otherwise start whatever took its place --
          // pressing Assemble while a session waited for input could set the
          // freshly assembled program running on its own.
          if (started && !e.programLoaded) break;
          if (e.isRunning || e.blocked) started = true;
          if (e.isRunning) continue;
          if (e.blocked) {
            resumeArmed = true;
            continue;
          }
          if (resumeArmed) {
            resumeArmed = false;
            emuRef.current.run();
            continue;
          }
          // Nothing observed yet: give the machine a moment to commit
          // its first state before deciding the session is over.
          if (!started && Date.now() - openedAt < 4000) continue;
          break;
        }
      } finally {
        emuRef.current.setSnapshotsPaused(false);
        emuRef.current.setOutputTap(null);
        io.setForeground(null);
        foregroundActiveRef.current = false;
        setForegroundLive(false);
      }
      const e = emuRef.current;
      return e.isHalted ? e.exitCode : null;
    },
    [],
  );

  // Run in terminal mode: hand the program the pane up front -- switch
  // the tab, then let the attach effect below start the drive once the
  // pane's io registration lands (the pane mounts lazily on the tab
  // switch, so the drive cannot start synchronously here).
  const handleRun = useCallback(() => {
    if (launchMode === "terminal" && chrome === "full") {
      // Cold load: nothing is assembled, so there is no screen to protect
      // and nothing to hand over yet. This was a silent no-op; in terminal
      // mode it becomes the one-action launch the mode promises. The run
      // button is disabled here, so this is the F5 / palette / handle path.
      if (!emu.programLoaded) {
        void launchInteractive();
        return;
      }
      // The terminal takeover WIPES the pane, so a finished or already
      // running program is left alone: without this, F5 and the palette
      // cleared a finished program's output and printed an exit line onto
      // an empty screen. An assembled program hands over without
      // re-assembling -- the same run press it has always been.
      if (emu.isHalted || emu.isRunning) return;
      setActiveTab("term");
      setPaneRequest({ pane: "term", nonce: Date.now() });
      setTermRunRequest(Date.now());
      return;
    }
    emu.run();
  }, [launchMode, chrome, emu, launchInteractive]);
  const handleRunRef = useRef(handleRun);
  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  // Attach a requested terminal-pane run: clear the pane (a previous
  // program's screen must not linger) and drive the workspace live,
  // with the pane printing the exit line when the session ends.
  useEffect(() => {
    if (termRunRequest == null || !termIO) return;
    // Check busy BEFORE consuming the nonce: dropping the request while
    // a session owns the pane silently swallowed the student's Run.
    if (foregroundActiveRef.current) return;
    setTermRunRequest(null);
    const io = termIO;
    void driveForeground(io, { clearAtStart: true }).then((exitCode) => {
      io.sessionEnded?.(exitCode);
    });
    // foregroundLive is a dependency so that a request held back above
    // gets another chance the moment the running session stands down.
    // Without it the request was preserved and then never honoured.
  }, [termRunRequest, termIO, driveForeground, foregroundLive]);

  // Self-attach: a raw-mode program started from the run button (not
  // `./name`) still deserves live terminal I/O. When the flag rises and
  // no session owns the pane, the pane takes the program over and
  // prints the exit line itself when the session ends.
  useEffect(() => {
    if (!emu.wantsTerminal) return;
    if (!termIO || foregroundActiveRef.current) return;
    const io = termIO;
    void driveForeground(io).then((exitCode) => {
      io.sessionEnded?.(exitCode);
    });
  }, [emu.wantsTerminal, termIO, driveForeground]);

  // The run-mode control is offered for the examples where both surfaces
  // are a real answer; every other program keeps today's header band.
  const showRunMode =
    chrome === "full" && loadedStem !== null && EXAMPLE_INTERACTIVE[loadedStem] === true;
  // Whether the composite launch has somewhere to land: only the terminal
  // mode owns the pane at run press, and only full chrome has a pane.
  const launchable = chrome === "full" && launchMode === "terminal";

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
        // The hint mirrors step-back's: the hub ignores step/run without a
        // loaded program, so the palette says why instead of no-oping mutely.
        description: emu.blocked
          ? "(waiting for stdin; feed the console first)"
          : emu.programLoaded
            ? "execute one instruction"
            : "(no program; assemble first)",
        shortcut: "F10",
        run: () => {
          if (!emu.blocked) emu.step();
        },
      },
      {
        id: "step-back",
        label: "Step back",
        description: emu.blocked
          ? "(waiting for stdin; feed the console first)"
          : emu.canStepBack
            ? "undo the last instruction from the snapshot ring"
            : "(no snapshots; run a step first)",
        shortcut: "Shift+F10",
        run: () => {
          if (!emu.blocked) emu.stepBack();
        },
      },
      {
        id: "run",
        label: "Run",
        // The list is rebuilt every time the palette opens, so the
        // description can name the surface this program's run lands in
        // rather than describing only the console flow. In terminal mode
        // with nothing assembled, run IS the launch, so it says so
        // instead of sending the student to the assemble button.
        description: emu.blocked
          ? "(waiting for stdin; feed the console first)"
          : launchable
            ? emu.programLoaded
              ? "hand the terminal pane to this program"
              : "assemble, then hand the terminal pane over"
            : emu.programLoaded
              ? "run until halt or breakpoint"
              : "(no program; assemble first)",
        shortcut: "F5",
        run: () => {
          if (!emu.blocked) handleRun();
        },
      },
      {
        id: "launch-terminal",
        label: "Start in the terminal",
        // Always present, with the description carrying the reason it
        // would do nothing -- a row that only sometimes exists is
        // unfindable by the student who saw it once.
        description: launchable
          ? "assemble and run with the terminal pane"
          : "(this program runs in the console)",
        run: () => {
          if (launchable) void launchInteractive();
        },
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
        run: () => resetMachine(),
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
        id: "base-converter",
        label: "Base converter",
        description: "hex, binary, decimal, and two's complement side by side",
        run: () => {
          setActiveTab("convert");
          setPaneRequest((prev) => ({ pane: "convert", nonce: (prev?.nonce ?? 0) + 1 }));
        },
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
    [emu, assembleWithHistory, handleRun, launchable, launchInteractive, resetMachine, source, toast, onOpenShareDialog, onOpenShortcutsHelp, onToggleTheme],
  );

  // Latest-value refs so the imperative handle stays a stable object while
  // still reading live editor / hub state when the host calls a method. The
  // refs are synced in an effect; the react-hooks rules forbid writing a ref
  // during render.
  const emuRef = useRef(emu);
  const sourceRef = useRef(source);
  const extraFilesRef = useRef(extraFiles);
  const argsRef = useRef(argsText);
  const cursorRef = useRef(cursor);
  const onStateChangeRef = useRef(onStateChange);
  const assembleRef = useRef(assembleWithHistory);
  const loadProgramRef = useRef(loadProgram);
  const buildCommandsRef = useRef(buildCommands);
  useEffect(() => {
    emuRef.current = emu;
    sourceRef.current = source;
    extraFilesRef.current = extraFiles;
    argsRef.current = argsText;
    cursorRef.current = cursor;
    onStateChangeRef.current = onStateChange;
    assembleRef.current = assembleWithHistory;
    loadProgramRef.current = loadProgram;
    buildCommandsRef.current = buildCommands;
  }, [emu, source, extraFiles, argsText, cursor, onStateChange, assembleWithHistory, loadProgram, buildCommands]);

  // Seed starter stdin once the hub is live so a program that reads has its
  // input queued before the first run.
  const seededStdin = useRef(false);
  useEffect(() => {
    if (chrome === "full") return;
    if (emu.isLoaded && startStdin && !seededStdin.current) {
      seededStdin.current = true;
      emu.pushStdin(startStdin);
    }
  }, [chrome, emu, emu.isLoaded, startStdin]);

  // Autoplay (landing hero only): once the hub is loaded, assemble the start
  // program and step it a bounded number of times on a timer so the registers
  // flash and the pc marker advances with no user action. Keyed STRICTLY on
  // [emu.isLoaded, autoplay]: useEmulator returns a NEW object after every step
  // (its memo deps include the changing registers/pc), so listing `emu` here
  // would re-run this effect after the first step, the cleanup would clear the
  // timer, and the once-per-engage guard would then block any restart -- the
  // hero would step once and freeze. The hub is read through emuRef (synced
  // every render above) so the timer survives the per-step re-renders.
  const hasAutoplayedRef = useRef(false);
  useEffect(() => {
    if (!autoplay || !emu.isLoaded || hasAutoplayedRef.current) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hasAutoplayedRef.current = true;

    const steps = Math.max(0, Math.min(autoplaySteps, AUTOPLAY_MAX_STEPS));
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const walk = async () => {
      // Assemble directly (not assembleWithHistory) so the hero never pollutes
      // the recent-programs list, and await it so the steps land on a loaded
      // program. Read the hub through emuRef so a register re-render cannot
      // strand the timer on a stale hub. Seeds re-apply after the successful
      // assemble, the same as every other assemble path.
      const ok = await emuRef.current.assemble(source, parseArgs(argsText));
      if (ok) applySeeds();
      if (cancelled || !ok || steps === 0) return;
      let stepped = 0;
      timer = setInterval(() => {
        emuRef.current.step();
        stepped += 1;
        if (stepped >= steps && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, AUTOPLAY_STEP_MS);
    };
    void walk();

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emu.isLoaded, autoplay]);

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

  // The checker's Check must evaluate a snapshot that matches the CURRENT
  // source, not whatever the last Run left behind -- otherwise a stale snapshot
  // can PASS on code the student already edited away, or every result fails on
  // zeroed pre-run state before any Run. Reuse runEmbed's assemble-if-stale
  // guard (the shared lastRunSourceRef): when nothing has run yet or the source
  // changed since the last run, assemble + run it to completion first, then
  // snapshot; an unchanged, already-run program is checked as-is. The run loop
  // is bounded by the emulator's own step ceiling; the wall-clock poll is only
  // a safety net, and reads the live hub through emuRef so a per-render new hub
  // identity is always observed.
  const checkEmbed = useCallback(async () => {
    if (emu.instructions.length === 0 || lastRunSourceRef.current !== source) {
      lastRunSourceRef.current = source;
      const ok = await emu.assemble(source, parseArgs(argsText));
      // A failed assemble must not reach the grader (mirroring runEmbed):
      // grading the stale machine marked structural checks green against
      // source that never built. The editor markers and the error banner
      // already say why nothing was graded.
      if (!ok) return;
      // Same post-assemble seeding as Run: the exercise's stdin and
      // fixtures must be on the freshly reset machine before it runs.
      applySeeds();
      emu.run();
      const startedAt = Date.now();
      do {
        await new Promise<void>((resolve) => setTimeout(resolve, 16));
      } while (emuRef.current.isRunning && Date.now() - startedAt < 10_000);
    }
    onCheck?.(currentState());
  }, [emu, source, argsText, onCheck, currentState, applySeeds]);

  // Stable handle identity; every method reads through a latest-value ref so
  // the object never needs rebuilding (no re-registration churn).
  const handle = useMemo<EmbeddablePlaygroundHandle>(
    () => ({
      assemble: () => assembleRef.current(),
      // Run, step, and back cannot pass a blocked read (the machine just
      // re-blocks), so while stdin is awaited they no-op like the disabled
      // buttons; assemble and reset stay live as the two real exits.
      run: () => {
        if (!emuRef.current.blocked) handleRunRef.current();
      },
      pause: () => emuRef.current.pause(),
      step: () => {
        if (!emuRef.current.blocked) emuRef.current.step();
      },
      stepBack: () => {
        if (!emuRef.current.blocked) emuRef.current.stepBack();
      },
      reset: () => resetMachine(),
      notifyError: (message: string) => toast.error(message),
      loadSource: (next: string) => loadSource(next),
      loadProgram: (payload: HandoffPayload) => loadProgramRef.current(payload),
      getSource: () => sourceRef.current,
      getFiles: () => extraFilesRef.current,
      getArgs: () => argsRef.current,
      getCursor: () => cursorRef.current,
      getCommands: () => buildCommandsRef.current(),
    }),
    // `toast` is referentially stable (useToast memoizes it); notifyError
    // reads it, so it belongs in the dependency list.
    [loadSource, resetMachine, toast],
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

  // Machine-produced lines resolve against the ASSEMBLED workspace; only the
  // gutter (which the student clicks in the buffer on screen) uses the live
  // one. Before the first assemble there is nothing pinned, so both fall back
  // to what is on screen.
  const machineMain = assembledLayout?.main ?? source;
  const machineExtras = assembledLayout?.extras ?? extraFiles;

  // The decode strip reads the line under the pc out of the source it is
  // handed, and `emu.currentLine` is a COMBINED-string line. Handing it
  // main.asm alone indexed past the end for any pc inside a helper, so the
  // gloss fell to its placeholder for the whole of a multi-file program --
  // and helper `define` aliases never labelled a register.
  // Keyed on the pin alone, so the concatenation happens once per assemble
  // rather than on every keystroke of a large workspace. Nothing is pinned
  // before the first assemble, and with no program there is no line to gloss.
  const pinnedCombined = useMemo(() => {
    if (!assembledLayout) return null;
    return assembledLayout.extras.length > 0
      ? combineSources(assembledLayout.main, assembledLayout.extras)
      : assembledLayout.main;
  }, [assembledLayout]);
  const decodeSource = pinnedCombined ?? source;

  const frameSlots = useMemo(() => parseFrameSlots(source), [source]);
  const fpValue = useMemo(() => {
    const raw = emu.registers[29];
    if (!raw) return 0;
    const clean = raw.startsWith("0x") ? raw.slice(2) : raw;
    return parseInt(clean, 16) || 0;
  }, [emu.registers]);

  // Hidden file picker the terminal's `upload` command triggers.
  const terminalUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void emuRef.current
        .lint(combineSources(source, extraFiles))
        .then(setLintWarnings)
        .catch(() => setLintWarnings([]));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [source, extraFiles]);

  // Per-file views of the combined-line diagnostics: the editor shows one
  // buffer at a time, so markers, the current-line highlight, and gutter
  // breakpoints each translate to the active file's local lines (and hide
  // when they belong to another file).
  const activeErrors = useMemo(
    () =>
      emu.assemblyErrors.flatMap((e) => {
        if (e.line <= 0) return activeFile === MAIN_FILE ? [e] : [];
        const loc = resolveLine(e.line, machineMain, machineExtras);
        return loc.file === activeFile ? [{ ...e, line: loc.line }] : [];
      }),
    [emu.assemblyErrors, machineMain, machineExtras, activeFile],
  );
  const activeLint = useMemo(
    () =>
      lintWarnings.flatMap((w) => {
        if (w.line <= 0) return activeFile === MAIN_FILE ? [w] : [];
        const loc = resolveLine(w.line, source, extraFiles);
        return loc.file === activeFile ? [{ ...w, line: loc.line }] : [];
      }),
    [lintWarnings, source, extraFiles, activeFile],
  );
  const activeCurrentLine = useMemo(() => {
    if (emu.currentLine == null) return null;
    const loc = resolveLine(emu.currentLine, machineMain, machineExtras);
    return loc.file === activeFile ? loc.line : null;
  }, [emu.currentLine, machineMain, machineExtras, activeFile]);
  const activeBreakpoints = useMemo(() => {
    const set = new Set<number>();
    for (const line of emu.breakpoints) {
      const loc = resolveLine(line, source, extraFiles);
      if (loc.file === activeFile) set.add(loc.line);
    }
    return set;
  }, [emu.breakpoints, source, extraFiles, activeFile]);
  const toggleBreakpointInActive = useCallback(
    (line: number) => {
      emu.toggleBreakpoint(
        combinedLineFor(activeFile, line, sourceRef.current, extraFilesRef.current),
      );
    },
    [emu, activeFile],
  );
  // Breakpoints live in the hub as COMBINED-string lines, so inserting five
  // lines in main.asm re-numbers every dot in every helper below it. Nothing
  // re-anchored them: the dots slid into the wrong file on screen, and the
  // next assemble re-keyed the stale numbers through a fresh line map onto
  // instructions they never belonged to. Only the SHAPE of the workspace can
  // move a line, so the re-anchor is keyed on line counts and typing inside a
  // line costs nothing.
  const layoutShape = useMemo(
    () =>
      `${countLines(source)}|${extraFiles.map((f) => countLines(f.body)).join(",")}`,
    [source, extraFiles],
  );
  // Seeded with the workspace as it stands at mount (the strip rehydrates
  // from storage), so the first pass has nothing to move.
  const bpLayoutRef = useRef<{ main: string; extras: SourceFile[] }>({
    main: source,
    extras: extraFiles,
  });
  useEffect(() => {
    const from = bpLayoutRef.current;
    const main = sourceRef.current;
    const extras = extraFilesRef.current;
    bpLayoutRef.current = { main, extras };
    const stored = emuRef.current.breakpoints;
    if (stored.size === 0) return;
    const moved = new Map<number, number | null>();
    let changed = false;
    for (const line of stored) {
      const loc = resolveLine(line, from.main, from.extras);
      // A closed tab takes its dots with it rather than donating them to
      // whichever file inherited its line numbers.
      const owner = loc.file === MAIN_FILE ? main : extras[loc.file]?.body;
      const to =
        owner == null
          ? null
          : combinedLineFor(
              loc.file,
              Math.min(loc.line, countLines(owner)),
              main,
              extras,
            );
      if (to !== line) changed = true;
      moved.set(line, to);
    }
    if (!changed) return;
    emuRef.current.remapBreakpoints((line) => moved.get(line) ?? null);
  }, [layoutShape]);
  // Controls shows the first error as plain text; name the owning file
  // when it is not the buffer labelled main.asm.
  const controlsError = useMemo(() => {
    if (!emu.error) return emu.error;
    const first = emu.assemblyErrors[0];
    if (!first || first.line <= 0 || machineExtras.length === 0) return emu.error;
    const loc = resolveLine(first.line, machineMain, machineExtras);
    if (loc.file === MAIN_FILE) return emu.error;
    return `${loc.name} line ${loc.line}: ${emu.error}`;
  }, [emu.error, emu.assemblyErrors, machineMain, machineExtras]);
  // Reads go through emuRef / sourceRef, not the render's hub object:
  // the hub is a new object every snapshot, so a closure over it freezes
  // mid-command state -- runProgram's wait loop would poll an isRunning
  // that can never change and report the pre-run stdout and exit code.
  // The refs also keep this callback's identity stable, so the terminal
  // pane never re-initializes underneath an open session.
  // `gcc -o name` registers compiled source here; `./name` runs it. A ref,
  // so the registry survives every per-snapshot context rebuild.
  const terminalExecutablesRef = useRef<Map<string, string>>(new Map());

  const buildTerminalContext = useCallback(() => {
    const dec = new TextDecoder();
    // One wait loop for every terminal-run shape: sleep BEFORE checking so
    // React has committed run()'s isRunning=true into the ref (see the
    // comment on the original runProgram).
    const waitForHalt = async () => {
      const startedAt = Date.now();
      do {
        await new Promise<void>((r) => setTimeout(r, 16));
      } while (emuRef.current.isRunning && Date.now() - startedAt < 10_000);
    };
    const runText = async (
      text: string,
      args: string[],
      stdin?: string,
      io?: import("@/lib/terminal/dispatch").TerminalProgramIO,
    ) => {
      // The tool assemble deliberately leaves the editor's console
      // scrollback alone, so the hub's stdout/stderr still hold whatever the
      // student was reading. Report this program's output as the DELTA over
      // that, or the terminal would replay the editor's session back at them.
      const priorOut = emuRef.current.stdout;
      const priorErr = emuRef.current.stderr;
      const since = (now: string, before: string) =>
        now.startsWith(before) ? now.slice(before.length) : now;
      // Tool-channel assemble: the terminal's program must not paint the
      // editor's error markers, and the verdict comes back directly. The
      // assemble wiped the machine, home directory included, so put the
      // working set back whatever the outcome.
      // args[0] is the `./name` the terminal displays; the emulator owns
      // argv[0] and re-adds it, so only argv[1..] goes through. Passing
      // the whole array would double the program name.
      const verdict = await emuRef.current.assembleForTool(text, args.slice(1));
      applySeeds();
      if (!verdict.success) {
        // The verdict is the only carrier of the assemble error here;
        // dropping it left the student with a bare "[no exit]" line.
        const e = emuRef.current;
        const detail = verdict.error
          ? verdict.errorLine != null
            ? `line ${verdict.errorLine}: ${verdict.error}`
            : verdict.error
          : "";
        return {
          stdout: since(e.stdout, priorOut),
          stderr: [since(e.stderr, priorErr), detail].filter(Boolean).join("\n"),
          exitCode: null,
        };
      }
      // Any `< file` stdin goes on top of the reseeded working set. A
      // redirect IS the whole input, so close stdin behind it: that is
      // what lets a read-until-EOF loop finish, exactly like
      // `./prog < file` on the course shell.
      if (stdin !== undefined) {
        // `./prog < bigfile` is one command that can hand the machine the
        // whole 4 MiB VFS cap in a single push; the redirect gets the same
        // bound as every other stdin ingress.
        const oversize = validateStdin(stdin);
        if (oversize) {
          return { stdout: "", stderr: oversize, exitCode: null };
        }
        emuRef.current.pushStdin(stdin);
        emuRef.current.closeStdin();
      }
      if (io) {
        // Interactive run: output streams into the pane as it is
        // produced, keystrokes reach stdin while the program lives, and
        // there is no wall-clock cap -- the machine's own step/output
        // walls bound a runaway, and the player owns the exit.
        const exitCode = await driveForeground(io);
        return {
          // Already streamed through the tap; nothing left to print.
          stdout: "",
          stderr: since(emuRef.current.stderr, priorErr),
          exitCode,
        };
      }
      emuRef.current.run();
      await waitForHalt();
      const e = emuRef.current;
      return {
        stdout: since(e.stdout, priorOut),
        stderr: since(e.stderr, priorErr),
        // null means "never exited" (blocked or timed out); the terminal
        // says so instead of inventing an exit 0.
        exitCode: e.exitCode,
      };
    };
    return {
      vfs: new Map<string, string>(),
      listVfs: () => emuRef.current.vfsFiles.slice().sort(),
      readVfs: async (path: string) => {
        const bytes = await emuRef.current.readVfsFile(path);
        if (bytes.length === 0 && !emuRef.current.vfsFiles.includes(path)) {
          return undefined; // distinguish missing from empty
        }
        return dec.decode(bytes);
      },
      writeVfs: (path: string, body: string) => {
        stageVfsFile(path, body);
      },
      deleteVfs: async (path: string) => removeVfsFile(path),
      // The editor's program: the same run shape as a compiled executable,
      // over the live workspace (main plus any extra files, exactly what
      // the assemble button builds).
      runProgram: async (
        args: string[],
        stdin?: string,
        io?: import("@/lib/terminal/dispatch").TerminalProgramIO,
      ) =>
        runText(
          combineSources(sourceRef.current, extraFilesRef.current),
          args,
          stdin,
          io,
        ),
      step: async () => {
        emuRef.current.step();
        const e = emuRef.current;
        return { halted: e.isHalted, line: e.currentLine };
      },
      runUntilBreak: async () => {
        emuRef.current.run();
        const startedAt = Date.now();
        // Same sleep-before-check shape as runProgram: the pre-run
        // isRunning is still false on the first read, and gdb's continue
        // must not resolve while the program is live.
        do {
          await new Promise<void>((r) => setTimeout(r, 16));
        } while (emuRef.current.isRunning && Date.now() - startedAt < 10_000);
        return { halted: emuRef.current.isHalted, hit_breakpoint: false };
      },
      setBreakpoint: async (addr: number) => emuRef.current.setBreakpointAddress(addr),
      clearBreakpoint: async (addr: number) => emuRef.current.clearBreakpointAddress(addr),
      resolveLabel: async (name: string) => emuRef.current.resolveLabel(name),
      m4Expand: async (text: string) => emuRef.current.m4Expand(text),
      assembleSource: async (text: string) => {
        const verdict = await emuRef.current.assembleForTool(text, []);
        // The gcc assemble wiped the home directory with the rest of the
        // machine; reseed it either way so `ls` right after a build (or
        // a failed one) still shows the student's files.
        applySeeds();
        if (verdict.success) return { success: true, errors: [] };
        const errors = verdict.error
          ? [
              verdict.errorLine != null
                ? `line ${verdict.errorLine}: ${verdict.error}`
                : verdict.error,
            ]
          : [];
        return { success: false, errors };
      },
      runSource: runText,
      executables: terminalExecutablesRef.current,
      readRegister: (name: string) => {
        const e = emuRef.current;
        const lower = name.toLowerCase();
        if (lower === "sp") return BigInt(e.sp);
        if (lower === "pc") return BigInt(e.pc);
        const m = lower.match(/^([xw])(\d+)$/);
        if (!m) return null;
        const idx = Number(m[2]);
        if (idx < 0 || idx > 30) return null;
        const raw = e.registers[idx];
        if (!raw) return null;
        // A `wN` name reads the low 32 bits, not the full 64-bit x register.
        const val = BigInt(raw);
        return m[1] === "w" ? val & 0xffff_ffffn : val;
      },
      readRegisters: () => {
        const e = emuRef.current;
        const out: Record<string, bigint> = {};
        e.registers.forEach((v, i) => {
          out[`x${i}`] = BigInt(v);
        });
        out.sp = BigInt(e.sp);
        out.pc = BigInt(e.pc);
        return out;
      },
      readMemory: async (addr: number, len: number) => emuRef.current.getMemory(addr, len),
      pcAddress: () => emuRef.current.pc,
      reset: async () => emuRef.current.reset(),
    };
  }, [stageVfsFile, removeVfsFile, applySeeds, driveForeground]);

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
  // panels (and their code) never load here. The editor / registers / console
  // arrangement comes from the container-driven embed-grid areas in
  // globals.css, so each host's own width (a prose measure, a wide hero)
  // picks the layout rather than the viewport.
  if (chrome !== "full") {
    return (
      <div className="embed-layout flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 embed-grid">
          <div className="embed-area-editor min-h-0 min-w-0 flex flex-col">
            <Editor
              value={source}
              onChange={readOnly ? () => {} : setSource}
              currentLine={emu.currentLine}
              currentLineInCall={emu.externalCall != null}
              breakpoints={emu.breakpoints}
              onToggleBreakpoint={emu.toggleBreakpoint}
              assemblyErrors={emu.assemblyErrors}
              lintWarnings={lintWarnings}
              onCursorChange={setCursor}
              focusRequest={errorFocus}
              readOnly={readOnly}
            />
          </div>
          <div className="embed-area-registers min-h-0 min-w-0 overflow-auto">
            <RegisterPanel
              registers={emu.registers}
              changedRegs={emu.changedRegs}
              sp={emu.sp}
              pc={emu.pc}
              nzcv={emu.nzcv}
            />
          </div>
          <div className="embed-area-console min-h-0 min-w-0 overflow-hidden flex flex-col">
            <ConsolePanel
              stdout={emu.stdout}
              stderr={emu.stderr}
              blocked={emu.blocked}
              exitCode={emu.exitCode}
              vfsFiles={emu.vfsFiles}
              pushStdin={emu.pushStdin}
              closeStdin={emu.closeStdin}
              uploadVfsFile={stageVfsFile}
              clearConsole={emu.clearConsole}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)]">
          {showRun && (
            // Run stays available on a halted machine: runEmbed re-assembles
            // and restarts, so a finished (or edited) program runs again
            // without a reset. Only an in-flight run disables it.
            <button
              type="button"
              onClick={() => void runEmbed()}
              disabled={emu.isRunning}
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
              onClick={() => void checkEmbed()}
              aria-label="check"
              className="min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              check
            </button>
          )}
          {/* A fault must be visible here too: full chrome surfaces
              emu.error through Controls, and without this line an embedded
              run that faults just stops silently. */}
          {emu.error && (
            <p
              role="alert"
              title={emu.error}
              className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--danger)]"
            >
              {emu.error}
            </p>
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
        backupCount={filesBackup.count}
        onRestoreBackup={filesBackup.restore}
        onAdd={(name) => {
          // A second tab with the same name strands one of them: a re-import
          // refreshes only the first. A tab called main.asm is worse -- it
          // still concatenates, and `resolveLine` labels its diagnostics
          // main.asm too, so the student hunts the error in the wrong buffer.
          const reason = validateFileName(name, extraFiles);
          if (reason) {
            toast.error(reason);
            return;
          }
          const clean = name.trim();
          const next: SourceFile = { name: clean, body: `// ${clean}\n` };
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
          const reason = validateFileName(name, extraFiles, idx);
          if (reason) {
            toast.error(reason);
            return;
          }
          const clean = name.trim();
          setExtraFiles(
            extraFiles.map((f, i) => (i === idx ? { ...f, name: clean } : f)),
          );
        }}
      />
      <div className="flex-1 min-h-0">
        <Editor
          value={editorValue}
          onChange={onEditorChange}
          currentLine={activeCurrentLine}
          currentLineInCall={emu.externalCall != null}
          breakpoints={activeBreakpoints}
          onToggleBreakpoint={toggleBreakpointInActive}
          assemblyErrors={activeErrors}
          lintWarnings={activeLint}
          onCursorChange={isMain ? setCursor : undefined}
          focusRequest={errorFocus}
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
          // Inside a libc call the pc is a trampoline word, which the
          // listing does not hold; mark and follow the `bl` instead.
          anchorPc={emu.externalCall?.callSitePc ?? null}
        />
      )}
    </div>
  );

  const regsBlock = (
    <div className="h-full flex flex-col">
      {/* The prominent, always-on decode strip heads the registers column --
          the beginner's lifeline: the plain-language gloss plus the live
          bit-field view of the word under the program counter. */}
      <DecodeStrip
        source={decodeSource}
        currentLine={emu.currentLine}
        encodingHex={
          emu.instructions.find((instr) => instr.address === emu.pc)?.hex ?? null
        }
        externalCall={
          // A live terminal session steps through libc calls constantly and
          // its input lands in the terminal pane, so the card's console
          // wording would be wrong there; the strip reads as it always has.
          emu.externalCall && !foregroundLive
            ? { name: emu.externalCall.name, waiting: emu.blocked }
            : null
        }
        sessionStarted={emu.programLoaded}
      />
      <ReplayScrubber
        frames={emu.replayFrames}
        currentStep={emu.stepCount}
        onSeek={emu.seekReplay}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <RegisterPanel
          registers={emu.registers}
          changedRegs={emu.changedRegs}
          fpRegisters={emu.fpRegisters}
          changedFpRegs={emu.changedFpRegs}
          sp={emu.sp}
          pc={emu.pc}
          nzcv={emu.nzcv}
        />
      </div>
    </div>
  );

  const memoryBlock = (
    <MemoryPanel
      getMemory={emu.getMemory}
      dirtyAddrs={emu.dirtyAddrs}
      regions={emu.memoryRegions}
      sp={emu.sp}
    />
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
      ownedByTerminal={foregroundLive || (launchMode === "terminal" && chrome === "full")}
      terminalOwnedFrom={terminalOwnedFrom}
      exitCode={emu.exitCode}
      vfsFiles={emu.vfsFiles}
      pushStdin={emu.pushStdin}
      closeStdin={emu.closeStdin}
      uploadVfsFile={stageVfsFile}
      clearConsole={clearConsoleAll}
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
            stageVfsFile(f.name, new Uint8Array(buf));
          });
          e.target.value = "";
        }}
      />
      <TerminalPane
        buildContext={buildTerminalContext}
        onUploadRequest={() => terminalUploadRef.current?.click()}
        onRegisterIO={(io) => {
          // Keep the ref in lockstep so a live drive sees a pane
          // teardown immediately, not one render later.
          termIORef.current = io;
          setTermIO(io);
        }}
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
      getMemoryMapped={emu.getMemoryMapped}
    />
  );
  const memWatchBlock = <MemoryWatches getMemory={emu.getMemory} />;
  const converterBlock = <BaseConverter />;
  const savesBlock = (
    <SavesPanel
      savedStates={emu.savedStates}
      onSaveState={emu.saveState}
      onLoadState={emu.loadState}
      onDeleteState={emu.deleteState}
      source={source}
      args={argsText}
      stepCount={emu.stepCount}
      onLoadProgram={loadProgram}
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
        {(["memory", "stack", "console", "term", "watches", "convert", "memwatch", "saves"] as const).map((tab) => {
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
        {/* The terminal stays MOUNTED once opened and hides with CSS.
            Unmounting it disposed xterm and dropped the io registration,
            so switching to another tab mid-session killed a running
            program's screen and its input -- the student had to re-run
            it. `hidden` keeps the DOM node (and the session) alive. */}
        {termOpened && (
          <div className={activeTab === "term" ? "h-full" : "hidden"}>
            {terminalBlock}
          </div>
        )}
        {activeTab === "watches" && (
          <div className="h-full overflow-auto">{watchBlock}</div>
        )}
        {activeTab === "convert" && (
          <div className="h-full overflow-auto">{converterBlock}</div>
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
      {/* header-band: under sm this row stops wrapping and scrolls within
          itself, so the editor stays near the top of a phone screen instead
          of sitting under seven rows of chrome. */}
      <div className="header-band safe-area-top flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-sunken)]">
        <span className="hidden sm:inline font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
          aarch64-pg
        </span>
        <div className="min-w-0 shrink-0">
          <ExampleLoader onLoad={loadProgram} />
        </div>
        <ImportExport
          source={source}
          files={extraFiles}
          target={importTarget}
          onImport={handleImport}
          onImportMany={handleImportMany}
        />
        <RecentPrograms
          entries={recent.entries}
          // A recent is a program delivery, not a text swap: the machine
          // resets and the seeds clear, so the previous program's
          // registers, console, stdin, and VFS cannot show under the
          // recalled source. The displaced buffer lands in recents.
          onLoad={(body) => loadProgram({ source: body })}
          onClear={recent.clear}
        />
        <ArgsInput source={source} value={argsText} onChange={setArgsText} />
        {showRunMode && (
          <RunModeControl
            mode={launchMode}
            onChange={handleLaunchModeChange}
            // A live session owns the pane; flipping the mode under it
            // would move the console's ownership badge mid-run.
            disabled={foregroundLive}
          />
        )}
        <Toolbar
          className="ml-auto"
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

      {/* A labeled section, not a main: this component is composed inside the
          landing hero, lessons, exercises, and the reference, all of which
          already sit inside their page's main. The /playground route supplies
          the one main around it. */}
      <section aria-label="cpsc 355 playground" className="flex-1 min-h-0 flex flex-col">
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
            converter={converterBlock}
            memwatch={memWatchBlock}
            saves={savesBlock}
            consoleBlocked={emu.blocked}
            paneRequest={paneRequest ?? undefined}
          />
        )}
      </section>

      <Controls
        onAssemble={assembleWithHistory}
        onStep={emu.step}
        onStepBack={emu.stepBack}
        canStepBack={emu.canStepBack}
        onRun={handleRun}
        onPause={emu.pause}
        onReset={resetMachine}
        isRunning={emu.isRunning}
        isAssembling={emu.isAssembling}
        isHalted={emu.isHalted}
        programLoaded={emu.programLoaded}
        // Terminal mode's run press on a cold load assembles and starts the
        // session, so the button must be reachable by mouse -- otherwise
        // the one-action launch exists only for the keyboard.
        runAssemblesFirst={launchable}
        blocked={emu.blocked}
        error={controlsError}
        stepCount={emu.stepCount}
      />

      <TutorialRunner
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onLoadSnippet={(src, label, args, stdin) => {
          // A snippet is a program delivery. Its stdin must ride as a
          // seed, not an immediate push: the assemble the tutorial asks
          // for next resets the machine, which would wipe a pushed queue
          // and re-apply the previous program's inputs instead.
          loadProgram({ source: src, label, args, stdin });
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
