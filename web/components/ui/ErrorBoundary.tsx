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
 * Class-based error boundary for panel subtrees. Next's error.tsx convention
 * nets only a whole route segment, so a single throwing panel would unmount
 * the entire playground, editor buffer included; this keeps the blast radius
 * to the panel that threw. A wrapped block that unmounts (a tab switch) gets
 * a fresh boundary on return.
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
          the {this.props.label} view hit an error -- reload the page to
          restore it; the rest of the playground keeps working
        </div>
      );
    }
    return this.props.children;
  }
}
