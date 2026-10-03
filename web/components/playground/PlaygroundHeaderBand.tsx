"use client";

import { useState } from "react";
import { ExampleLoader } from "@/components/playground/ExampleLoader";
import { ImportExport } from "@/components/playground/ImportExport";
import { RecentPrograms } from "@/components/playground/RecentPrograms";
import { ArgsInput } from "@/components/playground/ArgsInput";
import { RunModeControl } from "@/components/playground/RunModeControl";
import { Toolbar } from "@/components/playground/Toolbar";
import { MoreSheet } from "@/components/playground/MoreSheet";
import { Wordmark } from "@/components/ui/Wordmark";
import { MenuIcon } from "@/components/chrome/SiteIcons";
import { MobileNavDrawer } from "@/components/chrome/MobileNavDrawer";
import { useStarCount } from "@/components/chrome/StarCount";
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
  /** Null when the program has no console-or-terminal choice to make, which is
   *  every hand-written buffer. */
  runMode: {
    mode: LaunchMode;
    onChange: (next: LaunchMode) => void;
    disabled: boolean;
  } | null;
  onShare: () => void;
  onTutorials: () => void;
  /** Gathered by the shell, which owns the hub the snapshot reads. */
  buildDiagnostic: () => Promise<DiagnosticBundle>;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
  /** Starts the interface walkthrough; the phone's menu offers it directly. */
  onWalkthrough: () => void;
  /** The phone bar: home, examples, and a menu sheet with everything else. */
  compact?: boolean;
  /** A short laptop window: the band stands in for the site bar (home link
   *  and site menu) and leaves its tools to the run row. */
  short?: boolean;
}

/**
 * The playground's top row. It holds no state of its own: every control
 * reports to the shell, which owns the workspace and the machine.
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
  onTutorials,
  buildDiagnostic,
  onOpenCommandPalette,
  onOpenShortcuts,
  onWalkthrough,
  compact = false,
  short = false,
}: PlaygroundHeaderBandProps) {
  const stars = useStarCount();
  const [sheetOpen, setSheetOpen] = useState(false);
  // An action that opens a dialog of its own, or replaces the program, first
  // puts the sheet away.
  const fromSheet = (action: () => void) => () => {
    setSheetOpen(false);
    action();
  };

  const program = (
    <>
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
        // registers, console, stdin, and files cannot show under the
        // recalled source. The displaced buffer lands in recents.
        onLoad={(body) => {
          setSheetOpen(false);
          onLoadProgram({ source: body });
        }}
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
    </>
  );
  if (compact) {
    return (
      // The phone bar replaces both the site bar and the band, so it carries
      // the top safe area and the home link itself.
      <div className="pt-[var(--safe-top)] flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] pl-[max(0.75rem,var(--safe-left))] pr-[max(0.25rem,var(--safe-right))]">
        <Wordmark className="shrink-0 min-h-[44px]" />
        <ExampleLoader onLoad={onLoadProgram} fill />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="menu"
          aria-haspopup="dialog"
          data-walkthrough="menu"
          aria-expanded={sheetOpen}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          <MenuIcon />
        </button>
        <MoreSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          sections={[
            { key: "program", label: "program", content: program },
            {
              key: "tools",
              content: (
                <>
                  <Toolbar
                    onShare={fromSheet(onShare)}
                    onTutorials={fromSheet(onTutorials)}
                    buildDiagnostic={buildDiagnostic}
                    onOpenCommandPalette={fromSheet(onOpenCommandPalette)}
                    onOpenShortcuts={fromSheet(onOpenShortcuts)}
                    onWalkthrough={fromSheet(onWalkthrough)}
                  />
                </>
              ),
            },
          ]}
        />
      </div>
    );
  }

  // No top padding under the site bar, which carries the top safe area and
  // the name, so the band opens on the examples: a label here repeated the
  // bar's mark and, at 12px, pushed the 1440px band to a second row. A short
  // window drops that bar, so the band takes the safe area, the home link and
  // the site menu, and its tools move to the run row.
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 pb-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] ${
        short ? "pt-[max(0.5rem,var(--safe-top))]" : ""
      }`}
    >
      {short && <Wordmark className="shrink-0" />}
      <div className="min-w-0 shrink-0">
        <ExampleLoader onLoad={onLoadProgram} />
      </div>
      {program}
      {short ? (
        <div className="ml-auto">
          <MobileNavDrawer stars={stars} everywhere />
        </div>
      ) : (
        <Toolbar
          className="ml-auto"
          onShare={onShare}
          onTutorials={onTutorials}
          buildDiagnostic={buildDiagnostic}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenShortcuts={onOpenShortcuts}
        />
      )}
    </div>
  );
}
