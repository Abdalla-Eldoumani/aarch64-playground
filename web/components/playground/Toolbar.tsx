"use client";

import type { ReactNode } from "react";
import { DiagnosticBundle } from "@/components/playground/DiagnosticBundle";
import { REPO_URL } from "@/lib/content/site";
import type { DiagnosticBundle as DiagnosticBundleData } from "@/lib/playground/diagnostic-bundle";

export interface ToolbarProps {
  /** share and tools. */
  onShare: () => void;
  onTutorials: () => void;
  onToggleTheme: () => void;
  /** Gathers the diagnostic snapshot when its dialog opens; kept in the parent
   *  so the toolbar holds no emulator-hub state. */
  buildDiagnostic: () => Promise<DiagnosticBundleData>;
  /** Opens the keyboard shortcut list. */
  onOpenShortcuts: () => void;
  /** Starts the interface walkthrough from its own button. Only the phone's
   *  menu passes it: there the tutorials panel is a third tap away. */
  onWalkthrough?: () => void;
  /** Opens the standalone command-palette modal. A visible labeled control so
   *  discovery never depends on the Ctrl+K shortcut. */
  onOpenCommandPalette: () => void;
  className?: string;
}

// Compact secondary control. The 44px primary-target bar is the run controls;
// these supporting controls sit a step below it. Interaction reads cyan, the
// focus ring is the shared --ring token (same two-layer ring as every other
// control), and active presses travel one device pixel like the base button.
const CONTROL =
  "touch-target inline-flex items-center justify-center min-h-[36px] rounded-[var(--radius-control)] px-2.5 " +
  "text-[12px] font-sans transition-colors focus:outline-none " +
  "focus-visible:[box-shadow:var(--ring)] active:translate-y-px";
const INACTIVE =
  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]";

function GroupLabel({ children }: { children: ReactNode }) {
  // --type-label: mono, 12px, uppercase, 0.08em tracking.
  return (
    <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] select-none whitespace-nowrap">
      {children}
    </span>
  );
}

/**
 * Every tool is a visible, named button, so none depends on a shortcut. It
 * sits in the header band, at the end of the run row in a short window, and
 * in the phone's menu sheet.
 */
export function Toolbar({
  onShare,
  onTutorials,
  onToggleTheme,
  buildDiagnostic,
  onOpenShortcuts,
  onWalkthrough,
  onOpenCommandPalette,
  className = "",
}: ToolbarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <div role="group" aria-label="share and tools" className="flex flex-wrap items-center gap-2">
        <GroupLabel>tools</GroupLabel>
        <button
          type="button"
          onClick={onShare}
          aria-label="share program"
          data-walkthrough="share"
          className={`${CONTROL} ${INACTIVE}`}
        >
          share
        </button>
        <DiagnosticBundle build={buildDiagnostic} />
        <button
          type="button"
          onClick={onTutorials}
          data-walkthrough="tutorials"
          className={`${CONTROL} ${INACTIVE}`}
        >
          tutorials
        </button>
        {onWalkthrough && (
          <button type="button" onClick={onWalkthrough} className={`${CONTROL} ${INACTIVE}`}>
            walkthrough
          </button>
        )}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="toggle theme"
          className={`${CONTROL} ${INACTIVE}`}
        >
          theme
        </button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="source on github"
          className={`${CONTROL} ${INACTIVE}`}
        >
          source
        </a>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          // The accessible name matches the visible label (WCAG label-in-name);
          // the title still spells out what the button opens. The chip is
          // full-strength for contrast on hover states, and its key is drawn
          // by CSS from data-keys so the button's text stays the bare word.
          aria-label="commands"
          title="open the command palette (Ctrl+K)"
          data-walkthrough="commands"
          className={`${CONTROL} ${INACTIVE}`}
        >
          commands
          <kbd
            aria-hidden="true"
            data-keys="Ctrl+K"
            className="ml-1.5 hidden sm:inline-block [@media(pointer:coarse)]:hidden text-[12px] font-mono leading-none border border-current rounded px-1 py-[2px] after:content-[attr(data-keys)]"
          />
        </button>
        {/* No F keys on a touch screen, so no shortcut list either. */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="keyboard shortcuts"
          className={`${CONTROL} ${INACTIVE} [@media(pointer:coarse)]:hidden`}
        >
          ?
        </button>
      </div>
    </div>
  );
}
