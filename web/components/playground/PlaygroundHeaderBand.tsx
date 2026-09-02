"use client";

import { ExampleLoader } from "@/components/playground/ExampleLoader";
import { ImportExport } from "@/components/playground/ImportExport";
import { RecentPrograms } from "@/components/playground/RecentPrograms";
import { ArgsInput } from "@/components/playground/ArgsInput";
import { RunModeControl } from "@/components/playground/RunModeControl";
import { Toolbar } from "@/components/playground/Toolbar";
import type { RecentEntry } from "@/lib/playground/auto-save";
import type { DiagnosticBundle } from "@/lib/playground/diagnostic-bundle";
import type { SourceFile } from "@/lib/playground/file-map";
import type { ImportTarget } from "@/lib/hooks/use-import-target";
import type {
  HandoffPayload,
  LaunchMode,
} from "@/lib/playground/playground-handoff";

export interface PlaygroundHeaderBandProps {
  /** Program delivery: the example dropdown and the recents dropdown both
   *  hand a whole payload over, never a bare text swap. */
  onLoadProgram: (payload: HandoffPayload) => void;
  source: string;
  files: SourceFile[];
  /** Where the next single-file import lands; the shell computes it from the
   *  active tab. */
  importTarget: ImportTarget;
  onImport: (target: ImportTarget, body: string) => void;
  onImportMany: (files: { name: string; body: string }[]) => void;
  recent: { entries: RecentEntry[]; clear: () => void };
  args: string;
  onArgsChange: (next: string) => void;
  /** Null for every program that has no real answer to the console-or-terminal
   *  question, which is the band every hand-written buffer sees. */
  runMode: {
    mode: LaunchMode;
    onChange: (next: LaunchMode) => void;
    disabled: boolean;
  } | null;
  onShare: () => void;
  onTour: () => void;
  onToggleTheme: () => void;
  /** Built on click by the shell, which owns the hub the snapshot reads. */
  buildDiagnostic: () => DiagnosticBundle;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
}

/**
 * The full playground's top row: program in (examples, import, recents),
 * program arguments, the run-mode switch, and the tools group. It holds no
 * state of its own -- every control reports to the shell, which owns the
 * workspace and the machine.
 */
export function PlaygroundHeaderBand({
  onLoadProgram,
  source,
  files,
  importTarget,
  onImport,
  onImportMany,
  recent,
  args,
  onArgsChange,
  runMode,
  onShare,
  onTour,
  onToggleTheme,
  buildDiagnostic,
  onOpenCommandPalette,
  onOpenShortcuts,
}: PlaygroundHeaderBandProps) {
  return (
    // header-band: under sm this row stops wrapping and scrolls within
    // itself, so the editor stays near the top of a phone screen instead
    // of sitting under seven rows of chrome.
    <div className="header-band safe-area-top flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-sunken)]">
      <span className="hidden sm:inline font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
        aarch64-pg
      </span>
      <div className="min-w-0 shrink-0">
        <ExampleLoader onLoad={onLoadProgram} />
      </div>
      <ImportExport
        source={source}
        files={files}
        target={importTarget}
        onImport={onImport}
        onImportMany={onImportMany}
      />
      <RecentPrograms
        entries={recent.entries}
        // A recent is a program delivery, not a text swap: the machine
        // resets and the seeds clear, so the previous program's
        // registers, console, stdin, and VFS cannot show under the
        // recalled source. The displaced buffer lands in recents.
        onLoad={(body) => onLoadProgram({ source: body })}
        onClear={recent.clear}
      />
      <ArgsInput source={source} value={args} onChange={onArgsChange} />
      {runMode && (
        <RunModeControl
          mode={runMode.mode}
          onChange={runMode.onChange}
          // A live session owns the pane; flipping the mode under it
          // would move the console's ownership badge mid-run.
          disabled={runMode.disabled}
        />
      )}
      <Toolbar
        className="ml-auto"
        onShare={onShare}
        onTour={onTour}
        onToggleTheme={onToggleTheme}
        buildDiagnostic={buildDiagnostic}
        onOpenCommandPalette={onOpenCommandPalette}
        sourceLink={
          <a
            href="https://github.com/Abdalla-Eldoumani/aarch64-playground"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center min-h-[36px] rounded-[var(--radius-control)] px-2.5 text-[12px] font-sans text-[var(--text-secondary)] hover:text-[var(--cyan)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            aria-label="source on github"
          >
            source
          </a>
        }
      />
      <button
        type="button"
        onClick={onOpenShortcuts}
        className="shrink-0 inline-flex items-center min-h-[36px] text-xs text-[var(--text-secondary)] hover:text-[var(--cyan)] rounded px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        aria-label="keyboard shortcuts"
      >
        ?
      </button>
    </div>
  );
}
