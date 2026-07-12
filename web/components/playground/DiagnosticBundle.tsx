"use client";

import { useState } from "react";
import {
  bundleToMarkdown,
  type DiagnosticBundle as DiagnosticBundleData,
} from "@/lib/playground/diagnostic-bundle";

export interface DiagnosticBundleProps {
  /** Snapshot the parent assembles. Built lazily on click. */
  build: () => DiagnosticBundleData;
}

/**
 * Single button that captures the current emulator state into a markdown
 * bundle and writes it to the clipboard. The trailing share link in the
 * markdown round-trips through the playground's `?bundle=...` deep-link
 * handler so recipients can reopen the exact same scenario.
 */
export function DiagnosticBundle({ build }: DiagnosticBundleProps) {
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const onClick = async () => {
    try {
      const origin =
        typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;
      const md = bundleToMarkdown(build(), origin);
      await navigator.clipboard.writeText(md);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  const label = status === "ok" ? "copied" : status === "error" ? "copy failed" : "diagnostic bundle";

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs rounded px-2 py-1 bg-[var(--bg-sunken)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] whitespace-nowrap"
      aria-label="copy diagnostic bundle to clipboard"
    >
      {label}
    </button>
  );
}
