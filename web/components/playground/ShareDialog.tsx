"use client";

import { useRef, useState } from "react";
import { buildShareUrl, type ShareState } from "@/lib/playground/share";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

export interface ShareDialogProps {
  open: boolean;
  state: ShareState;
  onClose: () => void;
}

/**
 * Modal that builds a compressed `#p2=...` URL and offers copy/share.
 * Uses `navigator.share` when the platform supports it (iOS/Android),
 * falls back to a textarea with a copy button otherwise. The hash
 * carries the full editor state (source, args, stdin, view, cursor)
 * so the recipient lands in the same scenario the sender saw.
 */
export function ShareDialog({ open, state, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);
  // Build the URL during render; since we only read `state` and
  // `open`, this stays consistent without a setState-in-effect round.
  const url = open ? buildShareUrl(state) : "";

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const share = async () => {
    if (typeof navigator === "undefined" || !("share" in navigator)) {
      copy();
      return;
    }
    try {
      await navigator.share({ title: "cpsc 355 playground", url });
    } catch {
      // user cancelled or not supported; no-op
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
      role="dialog"
      aria-modal="true"
      aria-label="share program"
      onClick={onClose}
    >
      <div
        ref={ref}
        className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] shadow-2xl p-5 anim-modal-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-base font-semibold tracking-tight text-[var(--text-primary)] mb-3">
          share this program
        </h2>
        <p className="text-[11px] text-[var(--text-secondary)] mb-2">
          The source is compressed into the URL hash; nothing is sent to a server.
        </p>
        <textarea
          readOnly
          value={url}
          rows={4}
          className="w-full text-[11px] font-mono bg-[var(--bg-base)] border border-[var(--border)] rounded p-2 text-[var(--text-primary)]"
          onFocus={(e) => e.currentTarget.select()}
          aria-label="shareable url"
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            close
          </button>
          <button
            type="button"
            onClick={share}
            className="text-xs text-[var(--text-primary)] bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            share
          </button>
          <button
            type="button"
            onClick={copy}
            className={`text-xs rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
              copied
                ? "text-[var(--success)]"
                : "text-[var(--cyan)] hover:underline"
            }`}
          >
            {copied ? "copied" : "copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
