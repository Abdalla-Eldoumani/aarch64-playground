"use client";

import type { ReactNode } from "react";
import { DiagnosticBundle } from "@/components/DiagnosticBundle";
import type { DiagnosticBundle as DiagnosticBundleData } from "@/lib/diagnostic-bundle";

export interface ToolbarProps {
  /** view and modes: each is a labeled toggle reflecting a persisted mode. */
  cpsc355Enabled: boolean;
  onToggleCpsc355: () => void;
  lectureEnabled: boolean;
  onToggleLecture: () => void;
  hotspotEnabled: boolean;
  onToggleHotspot: () => void;
  /** share and tools. */
  onShare: () => void;
  onTour: () => void;
  onToggleTheme: () => void;
  /** Builds the diagnostic snapshot lazily on click; kept in the parent so the
   *  toolbar holds no emulator-hub state. */
  buildDiagnostic: () => DiagnosticBundleData;
  /** The GitHub source anchor, supplied by the parent so the playground owns
   *  the link's destination and styling. */
  sourceLink?: ReactNode;
  /** Opens the standalone command-palette modal. A visible labeled control so
   *  discovery never depends on the Ctrl+K shortcut. */
  onOpenCommandPalette: () => void;
  className?: string;
}

// Compact secondary control. The 44px primary-target bar is the run controls;
// these supporting controls sit a step below it. Interaction reads cyan.
const CONTROL =
  "inline-flex items-center min-h-[36px] rounded-[var(--radius-control)] px-2.5 " +
  "text-[12px] font-sans transition-colors focus:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-[var(--cyan)]";
const INACTIVE =
  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]";
const ACTIVE = "bg-[var(--cyan)] text-[var(--on-cyan)]";

function GroupLabel({ children }: { children: ReactNode }) {
  // --type-label: mono, 12px, uppercase, 0.08em tracking.
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] select-none whitespace-nowrap">
      {children}
    </span>
  );
}

/**
 * The playground's labeled, grouped toolbar. Two on-screen groups -- "view and
 * modes" (the persisted lint / lecture / hotspot toggles) and "share and tools"
 * (share, diagnostic bundle, guided tour, theme, source, and the command-palette
 * opener) -- replace the former unlabeled "..." overflow drawer, so every action
 * has a visible, named home and discovery never depends on a memorized shortcut.
 * The run controls (Assemble / Run / Step / Back / Reset) keep their dedicated
 * bottom bar, matching the reference layout.
 */
export function Toolbar({
  cpsc355Enabled,
  onToggleCpsc355,
  lectureEnabled,
  onToggleLecture,
  hotspotEnabled,
  onToggleHotspot,
  onShare,
  onTour,
  onToggleTheme,
  buildDiagnostic,
  sourceLink,
  onOpenCommandPalette,
  className = "",
}: ToolbarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <div role="group" aria-label="view and modes" className="flex flex-wrap items-center gap-2">
        <GroupLabel>view and modes</GroupLabel>
        <button
          type="button"
          onClick={onToggleCpsc355}
          aria-pressed={cpsc355Enabled}
          aria-label="toggle cpsc 355 lint mode"
          className={`${CONTROL} ${cpsc355Enabled ? ACTIVE : INACTIVE}`}
        >
          cpsc 355
        </button>
        <button
          type="button"
          onClick={onToggleLecture}
          aria-pressed={lectureEnabled}
          aria-label="toggle lecture mode"
          className={`${CONTROL} ${lectureEnabled ? ACTIVE : INACTIVE}`}
        >
          lecture
        </button>
        <button
          type="button"
          onClick={onToggleHotspot}
          aria-pressed={hotspotEnabled}
          aria-label="toggle hotspot heat map"
          className={`${CONTROL} ${hotspotEnabled ? ACTIVE : INACTIVE}`}
        >
          hotspot
        </button>
      </div>

      <div role="group" aria-label="share and tools" className="flex flex-wrap items-center gap-2">
        <GroupLabel>share and tools</GroupLabel>
        <button
          type="button"
          onClick={onShare}
          aria-label="share program"
          className={`${CONTROL} ${INACTIVE}`}
        >
          share
        </button>
        <DiagnosticBundle build={buildDiagnostic} />
        <button
          type="button"
          onClick={onTour}
          aria-label="start guided tour"
          className={`${CONTROL} ${INACTIVE}`}
        >
          tour
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="toggle theme"
          className={`${CONTROL} ${INACTIVE}`}
        >
          theme
        </button>
        {sourceLink}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="open command palette"
          className={`${CONTROL} ${INACTIVE}`}
        >
          commands
          <kbd className="ml-1.5 hidden sm:inline-block text-[10px] font-mono leading-none border border-current rounded px-1 py-[2px] opacity-70">
            Ctrl+K
          </kbd>
        </button>
      </div>
    </div>
  );
}
