"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAutoSavedBuffer } from "@/lib/playground/auto-save";

/**
 * The route error boundary, wearing the 404's fault-card register: a document
 * rule naming the fault by its hex address, the serif head, a mono gloss in the
 * decode strip's voice, and the two ways out (retry, or back to the
 * playground). A student who hits this can hand over a small markdown report
 * with one click: the autosaved program plus the error itself. There is no
 * emulator here to snapshot, so the report carries no machine state.
 *
 * This boundary sits above the (site) layout, so it supplies the route's own
 * <main id="main"> for the root layout's skip link.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");

  // The report is the whole bundle format, and this boundary needs it only
  // when the button is pressed, so the builder arrives through a dynamic
  // import: reaching it statically put the format in the script list of every
  // document, including the landing's. It is built as soon as the chunk lands
  // rather than inside the handler, so the clipboard write still happens in
  // the same task as the press.
  const [report, setReport] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/lib/playground/bundle-markdown").then(({ bundleToMarkdown }) => {
      if (!live) return;
      // In production Next replaces the message with a generic string and
      // hands the real one to the server logs under `digest`, so the digest is
      // the only way a student's report can be matched to a log line.
      const detail = error.digest
        ? `${error.message} (digest ${error.digest})`
        : error.message;
      const markdown = bundleToMarkdown({
        // The autosaved buffer is the one piece of the student's work an error
        // page can read; an unreadable or absent autosave reports as empty
        // rather than failing the copy.
        source: loadAutoSavedBuffer() ?? "",
        error: detail,
      });
      setReport(`${markdown}**route:** \`${window.location.pathname}\`\n`);
    });
    return () => {
      live = false;
    };
  }, [error]);

  const onCopy = async () => {
    // Nothing to hand over until the builder's chunk lands, a beat after
    // mount; the button says so by staying disabled until then.
    if (report === null) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopyState("ok");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  const copyLabel =
    copyState === "ok"
      ? "copied"
      : copyState === "error"
        ? "copy failed"
        : "copy error details";

  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex flex-col items-center justify-center flex-1 min-h-0 gap-6 px-6 text-center"
    >
      <div className="flex items-baseline gap-3 border-b border-[var(--border)] pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        <span>runtime fault</span>
        <span className="text-[var(--danger)]">0x00000500</span>
      </div>

      <h1 className="font-serif text-3xl font-semibold text-[var(--text-primary)]">
        something broke
      </h1>

      <p className="max-w-md font-sans text-sm text-[var(--text-secondary)]">
        the app hit an error while rendering this page. your saved program is
        untouched.
      </p>

      <p className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
        brk #0 · execution stopped before this page finished
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-[var(--cyan)] px-5 font-sans text-sm font-semibold text-[var(--on-cyan)] transition-colors hover:bg-[color-mix(in_srgb,var(--cyan)_88%,var(--text-primary))] active:translate-y-px focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          try again
        </button>
        <Link
          href="/playground"
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 font-sans text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          return to playground
        </Link>
        <button
          type="button"
          onClick={onCopy}
          disabled={report === null}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 font-mono text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          {copyLabel}
        </button>
      </div>
    </main>
  );
}
