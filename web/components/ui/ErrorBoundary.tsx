"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  /** Names the failed surface in the fallback so the reader knows what broke. */
  label: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches a crash inside one panel. Next's error.tsx covers only a whole
 * route, so one failing panel would take down the playground and the code in
 * the editor with it.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        // "Reload the page" is the one recovery that holds for every wrapped
        // panel: the terminal stays mounted across tab switches, so a tab
        // round trip cannot remount its boundary.
        <div role="alert" className="p-3 font-mono text-xs text-[var(--text-secondary)]">
          the {this.props.label} view hit an error. reload the page to
          restore it; the rest of the playground keeps working
        </div>
      );
    }
    return this.props.children;
  }
}
