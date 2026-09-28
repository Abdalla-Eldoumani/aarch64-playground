"use client";

import { useEffect, useState } from "react";
import { loadAutoSavedBuffer } from "@/lib/playground/auto-save";

/**
 * The error boundary for the root layout itself. It replaces the whole
 * document, so the stylesheet, font variables and theme may all be missing:
 * the colors below restate the dark tokens from app/globals.css and must move
 * with them, and the fonts fall back to generic stacks.
 */

const BG_BASE = "#0B0C10";
const BG_SUNKEN = "#0F1116";
const BG_ELEVATED = "#212630";
const BORDER = "#262B33";
const TEXT_PRIMARY = "#EDEEF1";
const TEXT_SECONDARY = "#A5ACB6";
const TEXT_TERTIARY = "#79808B";
const DANGER = "#FF6B6B";
const CYAN = "#3EC5E8";
const ON_CYAN = "#052430";

const MONO = '"JetBrains Mono", ui-monospace, "Consolas", monospace';
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const SERIF = '"Source Serif 4", Georgia, serif';

const BUTTON_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 20px",
  borderRadius: 4,
  cursor: "pointer",
  textDecoration: "none",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");

  // Imported on demand, since a static import put the report builder in every
  // page's scripts. The report is built as soon as it loads, not in the click
  // handler, so the clipboard write happens in the same task as the press.
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
        // The path rides in the status line, since the report ends with the
        // two sections the student fills in.
        status: `the page ${window.location.pathname} stopped with the error below`,
      });
      setReport(markdown);
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
    <html lang="en">
      <body style={{ margin: 0, background: BG_BASE, color: TEXT_PRIMARY }}>
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            minHeight: "100vh",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              borderBottom: `1px solid ${BORDER}`,
              paddingBottom: 8,
              fontFamily: MONO,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: TEXT_TERTIARY,
            }}
          >
            <span>runtime fault</span>
            <span style={{ color: DANGER }}>0x00000500</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 30,
              fontWeight: 600,
              color: TEXT_PRIMARY,
            }}
          >
            something broke
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: 448,
              fontFamily: SANS,
              fontSize: 14,
              lineHeight: 1.6,
              color: TEXT_SECONDARY,
            }}
          >
            the app hit an error before the page could load. your saved program is
            untouched.
          </p>

          <p
            style={{
              margin: 0,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              background: BG_SUNKEN,
              padding: "12px 16px",
              fontFamily: MONO,
              fontSize: 12,
              color: TEXT_SECONDARY,
            }}
          >
            brk #0 · execution stopped before this page finished
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                ...BUTTON_BASE,
                border: "none",
                background: CYAN,
                color: ON_CYAN,
                fontFamily: SANS,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              try again
            </button>
            {/* A plain anchor, not next/link: the root layout failed, so a full
                document load is the recovery, and the router is the thing we
                are least sure of here. */}
            <a
              href="/playground"
              style={{
                ...BUTTON_BASE,
                border: `1px solid ${BORDER}`,
                background: BG_SUNKEN,
                color: TEXT_PRIMARY,
                fontFamily: SANS,
                fontSize: 14,
              }}
            >
              return to playground
            </a>
            <button
              type="button"
              onClick={onCopy}
              disabled={report === null}
              style={{
                ...BUTTON_BASE,
                border: `1px solid ${BORDER}`,
                background: copyState === "idle" ? BG_SUNKEN : BG_ELEVATED,
                color: TEXT_SECONDARY,
                fontFamily: MONO,
                fontSize: 12,
              }}
            >
              {copyLabel}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
