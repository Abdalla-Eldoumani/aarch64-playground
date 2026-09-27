"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bundleToMarkdown } from "@/lib/playground/bundle-markdown";
import {
  bundleShareUrl,
  type DiagnosticBundle as DiagnosticBundleData,
} from "@/lib/playground/diagnostic-bundle";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

export interface DiagnosticBundleProps {
  /** Gathers the snapshot from the machine; called once per opening. */
  build: () => Promise<DiagnosticBundleData>;
}

/**
 * The tools button that opens the diagnostic bundle: a report of the run on
 * screen, shown before it is copied so the student sees exactly what it
 * holds, plus a link that reopens the program in the playground.
 */
export function DiagnosticBundle({ build }: DiagnosticBundleProps) {
  // The request is made on the press, not in the dialog's effect: `build` is
  // a new function on every snapshot, and an effect keyed on it would gather
  // the report again after every step of a run.
  const [request, setRequest] = useState<Promise<DiagnosticBundleData> | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setRequest(Promise.resolve().then(build))}
        aria-haspopup="dialog"
        className="touch-target text-xs rounded px-2 py-1 bg-[var(--bg-sunken)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] whitespace-nowrap"
      >
        diagnostic bundle
      </button>
      {/* Portalled to the body: under sm the header band is a scroll strip
          with an edge mask, and a mask paints everything inside the band
          through the band's box, a fixed dialog included, so the dialog was
          cut down to the band. */}
      {request &&
        createPortal(<BundleDialog request={request} onClose={() => setRequest(null)} />, document.body)}
    </>
  );
}

type Report = { markdown: string; link: string | null };

const ACTION =
  "text-xs rounded px-3 min-h-[44px] sm:min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]";

function BundleDialog({
  request,
  onClose,
}: {
  request: Promise<DiagnosticBundleData>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(true, ref, onClose);
  const [report, setReport] = useState<Report | "failed" | null>(null);
  const [copied, setCopied] = useState<"report" | "link" | "failed" | null>(null);

  useEffect(() => {
    let live = true;
    request.then(
      (bundle) => {
        if (!live) return;
        // The link is this page with the bundle as its only query, so nothing
        // else in the address bar travels with the report.
        const link = bundleShareUrl(`${window.location.origin}${window.location.pathname}`, bundle);
        setReport({ markdown: bundleToMarkdown(bundle, link ?? undefined), link });
      },
      () => {
        if (live) setReport("failed");
      },
    );
    return () => {
      live = false;
    };
  }, [request]);

  const ready = report !== null && report !== "failed" ? report : null;
  const link = ready?.link ?? null;

  const copy = async (what: "report" | "link", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied("failed");
    }
  };

  const status =
    copied === "report"
      ? "report copied. paste it where you ask for help, then fill in the last two sections."
      : copied === "link"
        ? "link copied."
        : copied === "failed"
          ? "copy failed: select the text in the box and copy it by hand."
          : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostic-bundle-title"
      onClick={onClose}
    >
      <div
        ref={ref}
        className="w-full max-w-2xl max-h-[92svh] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] shadow-2xl p-4 sm:p-5 anim-modal-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="diagnostic-bundle-title"
          className="font-serif text-base font-semibold tracking-tight text-[var(--text-primary)] mb-2"
        >
          diagnostic bundle
        </h2>
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] mb-3">
          a report on this run for a bug report or an AI assistant: your program, its input and
          output, and the machine&apos;s registers, stack, and memory. it holds nothing else, and
          nothing is sent anywhere; it stays on this page until you copy it.
        </p>
        {report === "failed" ? (
          <p role="alert" className="text-[11px] text-[var(--danger)] mb-2">
            the machine state could not be read. assemble the program again and reopen this.
          </p>
        ) : (
          <textarea
            readOnly
            value={ready?.markdown ?? ""}
            placeholder="reading the machine state..."
            aria-label="diagnostic report"
            aria-busy={ready === null}
            className="w-full h-[min(50svh,24rem)] resize-none text-[11px] leading-snug font-mono bg-[var(--bg-base)] border border-[var(--border)] rounded p-2 text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          />
        )}
        {ready && ready.link === null && (
          <p className="text-[11px] text-[var(--text-secondary)] mt-2">
            this program is too large for a link. export it with the .json button in the header
            and send the file with the report.
          </p>
        )}
        <p role="status" className="text-[11px] min-h-[1.25rem] mt-2 text-[var(--text-secondary)]">
          {status}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className={`${ACTION} text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
          >
            close
          </button>
          {link && (
            <button
              type="button"
              onClick={() => void copy("link", link)}
              className={`${ACTION} text-[var(--cyan)] border border-[var(--border)] hover:bg-[var(--bg-elevated)]`}
            >
              copy link
            </button>
          )}
          <button
            type="button"
            disabled={!ready}
            onClick={() => ready && void copy("report", ready.markdown)}
            className={`${ACTION} text-[var(--text-primary)] bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)]`}
          >
            copy report
          </button>
        </div>
      </div>
    </div>
  );
}
