"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEmulator } from "@/lib/use-emulator";
import { useBreakpoint, isAtLeast } from "@/lib/use-breakpoint";
import { useAutoSave, useRecentPrograms, loadAutoSavedBuffer } from "@/lib/auto-save";
import { readShareHash } from "@/lib/share";
import { parseFrameSlots } from "@/lib/frame-labels";
import type { Action } from "@/lib/commands";
import { Editor } from "@/components/Editor";
import { RegisterPanel } from "@/components/RegisterPanel";
import { MemoryPanel } from "@/components/MemoryPanel";
import { StackPanel } from "@/components/StackPanel";
import { ConsolePanel } from "@/components/ConsolePanel";
import { Controls } from "@/components/Controls";
import { DiagnosticBundle } from "@/components/DiagnosticBundle";
import { ExplainStrip } from "@/components/ExplainStrip";
import { InstructionView } from "@/components/InstructionView";
import { ExampleLoader } from "@/components/ExampleLoader";
import { RecentPrograms } from "@/components/RecentPrograms";
import { ResizableLayout } from "@/components/ResizableLayout";
import { MobileLayout } from "@/components/MobileLayout";
import { ImportExport } from "@/components/ImportExport";
import { useToast } from "@/components/Toast";
import { HeaderOverflowSheet } from "@/components/HeaderOverflowSheet";
import { parseDeepLink } from "@/lib/use-deep-link";
import { parseArgs } from "@/lib/args";
import { ArgsInput } from "@/components/ArgsInput";
import {
  describeTarget,
  getImportTarget,
  type ImportTarget,
} from "@/lib/use-import-target";
import { WatchPanel } from "@/components/WatchPanel";
import { MemoryWatches } from "@/components/MemoryWatches";
import {
  MultiFileTabs,
  combineSources,
  useSourceFiles,
  type SourceFile,
} from "@/components/MultiFileTabs";
import type { Shortcut } from "@/components/ShortcutsHelp";
import { useTheme } from "@/lib/use-theme";
import dynamic from "next/dynamic";

// Heavy components load on first use. `CToAsmView` and `DiffView` each
// ship their own Monaco instance; keeping them out of the initial bundle
// cuts the landing payload by ~300 kB gzipped. The three modals
// (command palette, shortcuts help, share dialog) are only mounted once
// the user opens them.
const CToAsmView = dynamic(
  () => import("@/components/CToAsmView").then((m) => m.CToAsmView),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">loading C view...</div> },
);
const DiffView = dynamic(
  () => import("@/components/DiffView").then((m) => m.DiffView),
  { ssr: false },
);
const CommandPalette = dynamic(
  () => import("@/components/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);
const ShortcutsHelp = dynamic(
  () => import("@/components/ShortcutsHelp").then((m) => m.ShortcutsHelp),
  { ssr: false },
);
const ShareDialog = dynamic(
  () => import("@/components/ShareDialog").then((m) => m.ShareDialog),
  { ssr: false },
);
const TutorialRunner = dynamic(
  () => import("@/components/TutorialRunner").then((m) => m.TutorialRunner),
  { ssr: false },
);

const DEFAULT_SOURCE = `// cpsc 355 playground
// write ARM64 assembly, hit Assemble, then Step or Run

    MOV X0, #5       // n = 5
    MOV X1, #1       // result = 1
loop:
    MUL X1, X1, X0   // result *= n
    SUBS X0, X0, #1  // n--
    B.GT loop
    SVC #0            // halt
`;

const SHORTCUTS: Shortcut[] = [
  { keys: "F6", description: "assemble" },
  { keys: "F10", description: "step" },
  { keys: "Shift+F10", description: "step back (up to 128 frames)" },
  { keys: "F5", description: "run / pause" },
  { keys: "Shift+F5", description: "reset" },
  { keys: "Ctrl+K", description: "open command palette" },
  { keys: "Ctrl+S", description: "auto-save (also runs every 500ms)" },
  { keys: "?", description: "show this help" },
];

function initialSource(): { source: string; fromShare: boolean } {
  if (typeof window === "undefined") return { source: DEFAULT_SOURCE, fromShare: false };
  const fromHash = readShareHash(window.location.hash);
  if (fromHash) return { source: fromHash, fromShare: true };
  const saved = loadAutoSavedBuffer();
  if (saved && saved.length > 0) return { source: saved, fromShare: false };
  return { source: DEFAULT_SOURCE, fromShare: false };
}

function initialView(): "playground" | "c-to-asm" {
  if (typeof window === "undefined") return "playground";
  const v = new URLSearchParams(window.location.search).get("view");
  return v === "c-to-asm" ? "c-to-asm" : "playground";
}

export default function Home() {
  const emu = useEmulator();
  const bp = useBreakpoint();
  const [{ source, fromShare }, setSourceState] = useState(initialSource);
  const setSource = useCallback((next: string) => {
    setSourceState((prev) => ({ source: next, fromShare: prev.fromShare }));
  }, []);
  const [activeTab, setActiveTab] = useState<
    "memory" | "stack" | "console" | "watches" | "memwatch" | "saves"
  >("memory");
  const [view, setView] = useState<"playground" | "c-to-asm">(initialView);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [argsText, setArgsText] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBanner, setShareBanner] = useState(fromShare);
  const [diffOpen, setDiffOpen] = useState(false);
  const [baseline, setBaseline] = useState<{ source: string; label: string }>(
    { source: DEFAULT_SOURCE, label: "starter snippet" },
  );
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [, toggleTheme, setTheme] = useTheme();
  const [embed, setEmbed] = useState<boolean>(false);
  const [extraFiles, setExtraFiles] = useSourceFiles();
  const [activeFile, setActiveFile] = useState<number>(-1);
  const toast = useToast();
  const importTarget = getImportTarget(view, activeFile);
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
        case "c-to-asm":
          setView("playground");
          setSource(body);
          toast.show("switched to playground and imported");
          return;
      }
    },
    [extraFiles, setExtraFiles, setSource, toast],
  );
  const [saveName, setSaveName] = useState("");
  const loadAsBaseline = useCallback(
    (next: string, label: string) => {
      setSourceState({ source: next, fromShare: false });
      setBaseline({ source: next, label });
    },
    [],
  );

  useAutoSave(source);
  const recent = useRecentPrograms();

  // Push the current buffer onto the recent list whenever the user
  // assembles. Hashing by content means the same example loaded twice
  // in a row doesn't crowd out unrelated work.
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
    // When the student has extra files registered, concatenate them so
    // `bl func` in main.asm can reach `func:` defined in a sibling
    // file. The linker operates on one string; this is the simplest
    // form of multi-file assembly.
    const combined =
      extraFiles.length > 0 ? combineSources(source, extraFiles) : source;
    emu.assemble(combined, parseArgs(argsText));
  }, [source, recent, emu, extraFiles, argsText]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (view === "c-to-asm") url.searchParams.set("view", "c-to-asm");
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url.toString());
  }, [view]);

  // Auto-switch to the console on the false->true edge of `blocked` so
  // the student sees the scanf prompt. Using queueMicrotask defers the
  // state flip out of the synchronous render phase.
  const lastBlockedRef = useRef(false);
  useEffect(() => {
    if (emu.blocked && !lastBlockedRef.current) {
      lastBlockedRef.current = true;
      queueMicrotask(() => setActiveTab("console"));
    } else if (!emu.blocked) {
      lastBlockedRef.current = false;
    }
  }, [emu.blocked]);

  // Keyboard shortcuts and palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "?" && !(e.target instanceof HTMLInputElement) &&
                 !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (meta && e.key === "Enter") {
        e.preventDefault();
        assembleWithHistory();
      } else if (e.key === "F10") {
        e.preventDefault();
        emu.step();
      } else if (e.key === "F5" && !e.shiftKey) {
        e.preventDefault();
        if (emu.isRunning) emu.pause();
        else emu.run();
      } else if (e.key === "F5" && e.shiftKey) {
        e.preventDefault();
        emu.reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emu, assembleWithHistory]);

  const actions = useMemo<Action[]>(
    () => [
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
        run: () => setShareOpen(true),
      },
      {
        id: "diff",
        label: "Diff against baseline",
        description: `compare the editor against "${baseline.label}"`,
        run: () => setDiffOpen(true),
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
        run: () => toggleTheme(),
      },
      {
        id: "toggle-view",
        label: view === "playground" ? "Open C to ASM view" : "Back to playground",
        description: "flip between the two top-level views",
        run: () => setView(view === "playground" ? "c-to-asm" : "playground"),
      },
      {
        id: "help",
        label: "Keyboard shortcuts",
        description: "open the shortcuts help modal",
        shortcut: "?",
        run: () => setHelpOpen(true),
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
    [emu, view, assembleWithHistory, baseline.label, toggleTheme, source],
  );

  const isMain = activeFile === -1;
  const editorValue = isMain ? source : extraFiles[activeFile]?.body ?? "";
  const onEditorChange = useCallback(
    (next: string) => {
      if (isMain) {
        setSource(next);
      } else {
        setExtraFiles(
          extraFiles.map((f, i) =>
            i === activeFile ? { ...f, body: next } : f,
          ),
        );
      }
    },
    [isMain, activeFile, extraFiles, setExtraFiles, setSource],
  );
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
        />
      </div>
    </div>
  );

  const disasmBlock = (
    <div className="h-full overflow-auto">
      <InstructionView
        instructions={emu.instructions}
        pc={emu.pc}
        codeBase={emu.codeBase}
      />
    </div>
  );

  const regsBlock = (
    <div className="h-full overflow-auto">
      <RegisterPanel
        registers={emu.registers}
        changedRegs={emu.changedRegs}
        sp={emu.sp}
        pc={emu.pc}
        nzcv={emu.nzcv}
      />
    </div>
  );

  const memoryBlock = <MemoryPanel getMemory={emu.getMemory} />;
  const frameSlots = useMemo(() => parseFrameSlots(source), [source]);
  const fpValue = useMemo(() => {
    const raw = emu.registers[29];
    if (!raw) return 0;
    const clean = raw.startsWith("0x") ? raw.slice(2) : raw;
    return parseInt(clean, 16) || 0;
  }, [emu.registers]);
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
    <div className="p-3 text-xs flex flex-col h-full">
      <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px] mb-2">
        save states
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (saveName.trim()) {
            emu.saveState(saveName.trim());
            setSaveName("");
          }
        }}
        className="flex gap-1 mb-2"
      >
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="checkpoint name"
          className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] text-[var(--text-primary)]"
          aria-label="save state name"
        />
        <button
          type="submit"
          className="px-2 py-0.5 text-[11px] rounded bg-[var(--accent-muted)] hover:bg-[var(--accent)] hover:text-black text-[var(--text-primary)]"
        >
          save
        </button>
      </form>
      <ul className="flex-1 overflow-auto space-y-1">
        {emu.savedStates.length === 0 && (
          <li className="text-[10px] text-[var(--text-secondary)]">
            no saved states yet.
          </li>
        )}
        {emu.savedStates.map((name) => (
          <li
            key={name}
            className="flex items-center justify-between gap-2 font-mono"
          >
            <span className="text-[var(--text-primary)] truncate">{name}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => emu.loadState(name)}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                load
              </button>
              <button
                type="button"
                onClick={() => emu.deleteState(name)}
                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--danger)]"
              >
                delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  const rightTabs = (
    <div className="h-full flex flex-col">
      <div
        className="flex flex-wrap border-b border-[var(--border)] overflow-x-auto"
        role="tablist"
        aria-label="debug view"
      >
        {(["memory", "stack", "console", "watches", "memwatch", "saves"] as const).map((tab) => {
          const selected = activeTab === tab;
          const showDot = tab === "console" && emu.blocked && !selected;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={selected}
              className={`relative min-h-[2.25rem] px-4 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                selected
                  ? "text-[var(--accent)] border-b border-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {showDot && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "memory" && (
          <div className="h-full overflow-auto">{memoryBlock}</div>
        )}
        {activeTab === "stack" && (
          <div className="h-full overflow-auto">{stackBlock}</div>
        )}
        {activeTab === "console" && (
          <div className="h-full flex flex-col">{consoleBlock}</div>
        )}
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

  const onLoadIntoPlayground = useCallback(
    (asm: string) => {
      setSource(asm);
      setView("playground");
    },
    [setSource],
  );

  // Deep-link bootstrap. Runs once on mount: applies ?theme=, ?view=,
  // ?embed=, and (if ?example=<stem> resolves to a real file) loads the
  // example into the editor. Errors during the example fetch are
  // silently dropped -- the user can still load via the dropdown.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dl = parseDeepLink(window.location.search);
    if (dl.theme) setTheme(dl.theme);
    if (dl.view) setView(dl.view);
    if (dl.embed) setEmbed(true);
    if (dl.bundle) {
      loadAsBaseline(dl.bundle.source, "diagnostic bundle");
      if (dl.bundle.args !== undefined) setArgsText(dl.bundle.args);
      if (dl.bundle.stdin) emu.pushStdin(dl.bundle.stdin);
    } else if (dl.example) {
      const tryLoad = async (ext: "asm" | "s") => {
        const res = await fetch(`/examples/cpsc355/${dl.example}.${ext}`);
        if (!res.ok) return false;
        const text = await res.text();
        loadAsBaseline(text, dl.example ?? "example");
        return true;
      };
      void (async () => {
        if (!(await tryLoad("asm"))) await tryLoad("s");
      })();
    }
    // Effect runs once at mount; deep-link state is read from the URL
    // exactly once and never re-derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Buttons that live in the header at md+ and inside the overflow sheet
  // below md. `after` fires after the action runs so the sheet auto-closes
  // when one is chosen on a phone.
  const renderSecondaryActions = (after?: () => void) => {
    const wrap = <T extends () => void>(fn: T) => () => {
      fn();
      after?.();
    };
    return (
      <>
        <RecentPrograms
          entries={recent.entries}
          onLoad={(body) => {
            loadAsBaseline(body, "recent program");
            after?.();
          }}
          onClear={recent.clear}
        />
        <button
          type="button"
          onClick={wrap(() =>
            setView(view === "c-to-asm" ? "playground" : "c-to-asm"),
          )}
          className={`text-xs rounded px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] whitespace-nowrap ${
            view === "c-to-asm"
              ? "bg-[var(--accent)] text-black"
              : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
          }`}
          aria-pressed={view === "c-to-asm"}
        >
          C -&gt; asm
        </button>
        <button
          type="button"
          onClick={wrap(() => setShareOpen(true))}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="share program"
        >
          share
        </button>
        <button
          type="button"
          onClick={wrap(() => setDiffOpen(true))}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="diff against baseline"
        >
          diff
        </button>
        <DiagnosticBundle
          build={() => ({
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
        />
        <button
          type="button"
          onClick={wrap(() => setTutorialOpen(true))}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="open tutorial runner"
        >
          tour
        </button>
        <button
          type="button"
          onClick={wrap(toggleTheme)}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="toggle theme"
        >
          theme
        </button>
        <button
          type="button"
          onClick={wrap(() => setPaletteOpen(true))}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="open command palette"
        >
          cmd
        </button>
        <a
          href="https://github.com/Abdalla-Eldoumani/aarch64-playground"
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded px-1"
          aria-label="View source on GitHub"
          onClick={() => after?.()}
        >
          source
        </a>
      </>
    );
  };

  if (emu.loadError) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 px-6 text-center">
        <span className="text-sm text-red-400">failed to load emulator</span>
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

  return (
    <div className="flex flex-col flex-1 min-h-0" data-embed={embed ? "1" : undefined}>
      <div className="safe-area-top flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <span className="hidden sm:inline font-serif text-[15px] font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0">
          cpsc 355 playground
        </span>
        <div className="min-w-0 flex-1 sm:flex-initial overflow-hidden">
          <ExampleLoader
            onLoad={(src, label) => loadAsBaseline(src, label ?? "example")}
          />
        </div>
        <ArgsInput source={source} value={argsText} onChange={setArgsText} />
        <div className="hidden md:flex items-center gap-3">
          <ImportExport source={source} target={importTarget} onImport={handleImport} />
          {renderSecondaryActions()}
        </div>
        <button
          type="button"
          onClick={() => setOverflowOpen(true)}
          className="md:hidden shrink-0 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="more actions"
          aria-haspopup="dialog"
          aria-expanded={overflowOpen}
        >
          ...
        </button>
        <div className="hidden md:flex flex-1" />
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="shrink-0 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="keyboard shortcuts"
        >
          ?
        </button>
      </div>
      <HeaderOverflowSheet open={overflowOpen} onClose={() => setOverflowOpen(false)}>
        <ImportExport source={source} target={importTarget} onImport={handleImport} />
        {renderSecondaryActions(() => setOverflowOpen(false))}
      </HeaderOverflowSheet>

      {shareBanner && (
        <div
          role="status"
          className="px-4 py-1 text-[11px] text-[var(--accent)] border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between"
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

      <div className="flex-1 min-h-0 flex flex-col">
        {view === "c-to-asm" ? (
          <CToAsmView
            onLoadIntoPlayground={onLoadIntoPlayground}
            onClose={() => setView("playground")}
          />
        ) : showResizable ? (
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
            watches={watchBlock}
            memwatch={memWatchBlock}
            saves={savesBlock}
            consoleBlocked={emu.blocked}
          />
        )}
      </div>

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
      <ExplainStrip source={source} currentLine={emu.currentLine} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={actions}
      />
      <ShortcutsHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={SHORTCUTS}
      />
      <ShareDialog
        open={shareOpen}
        source={source}
        onClose={() => setShareOpen(false)}
      />
      <DiffView
        open={diffOpen}
        baseline={baseline.source}
        baselineLabel={baseline.label}
        current={source}
        onClose={() => setDiffOpen(false)}
      />
      <TutorialRunner
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onLoadSnippet={(src, label, args, stdin) => {
          loadAsBaseline(src, label);
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
    </div>
  );
}
