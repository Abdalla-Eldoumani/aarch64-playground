"use client";

import { useId, useRef, useState } from "react";
import { buildShareUrl, readShareHash, shareHashSize, type ShareState } from "@/lib/playground/share";
import { closeOnBackdropClick, useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { SITE_NAME } from "@/lib/content/site";

export interface ShareDialogProps {
  open: boolean;
  state: ShareState;
  onClose: () => void;
}

/**
 * The link for `state`, and whether the receiver gets all of it. Its own
 * reader decides: past its caps the link opens to a "too large" banner, and
 * checks or files it cannot read whole are dropped without a word, so the
 * sender must be told here rather than handed a link that is already broken.
 */
function measure(state: ShareState) {
  const url = buildShareUrl(state);
  const hashAt = url.indexOf("#");
  const hash = hashAt < 0 ? "" : url.slice(hashAt);
  const read = readShareHash(hash);
  const whole =
    read.kind === "ok" &&
    (read.state.checks?.length ?? 0) === (state.checks?.length ?? 0) &&
    (read.state.files?.length ?? 0) === (state.files?.length ?? 0);
  return { url, size: shareHashSize(hash), whole };
}

/**
 * The `#p2=` hash carries the whole editor state (files, args, stdin, cursor,
 * checks), so the recipient opens the program exactly as the sender saw it.
 */
export function ShareDialog({ open, state, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [withChecks, setWithChecks] = useState(true);
  const checksId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);
  const checkCount = state.checks?.length ?? 0;

  if (!open) return null;

  // Built during render from `state` and `withChecks` alone, so no
  // setState-in-effect round is needed.
  const bare = { ...state, checks: undefined };
  const link = measure(withChecks ? state : bare);
  const { url, size } = link;
  const refused = !link.whole;
  // The checks are named as the cause only when the program alone would travel.
  const checksTooLarge = refused && withChecks && checkCount > 0 && measure(bare).whole;

  // Without the platform's share sheet a share button could only copy, so
  // it would be a second copy button under another name.
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard permission denied or unavailable; the url stays selectable by hand.
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: SITE_NAME, url });
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
      onClick={closeOnBackdropClick(onClose)}
    >
      <div
        ref={ref}
        className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] shadow-2xl p-5 anim-modal-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-base font-semibold tracking-tight text-[var(--text-primary)] mb-3">
          Share this program
        </h2>
        {checksTooLarge ? (
          <p role="alert" className="text-[12px] text-[var(--danger)] mb-2">
            {checkCount === 1 ? "the check is" : "the checks are"} too large to carry in a
            link. untick the box below to share the program alone.
          </p>
        ) : refused ? (
          <p role="alert" className="text-[12px] text-[var(--danger)] mb-2">
            this workspace does not fit in a link
            {size.chars > size.max &&
              ` (${size.chars.toLocaleString()} characters compressed, limit ${size.max.toLocaleString()})`}
            . pick workspace .json from the export menu in the header and send
            that file instead.
          </p>
        ) : (
          <p className="text-[12px] text-[var(--text-secondary)] mb-2">
            the program is packed into the link itself; nothing is sent to a server.
          </p>
        )}
        {checkCount > 0 && (
          <div className="flex items-center gap-2 mb-2 text-[12px] text-[var(--text-primary)]">
            <input
              id={checksId}
              type="checkbox"
              checked={withChecks}
              onChange={(e) => setWithChecks(e.target.checked)}
              className="touch-target accent-[var(--cyan)]"
            />
            <label htmlFor={checksId}>
              include the {checkCount === 1 ? "check" : `${checkCount} checks`}
            </label>
          </div>
        )}
        {!refused && (
          <textarea
            readOnly
            value={url}
            rows={4}
            className="w-full text-[12px] font-mono bg-[var(--bg-base)] border border-[var(--border)] rounded p-2 text-[var(--text-primary)]"
            onFocus={(e) => e.currentTarget.select()}
            aria-label="shareable url"
          />
        )}
        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="touch-target text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            close
          </button>
          {canShare && (
            <button
              type="button"
              onClick={share}
              disabled={refused}
              className="touch-target text-xs text-[var(--text-primary)] bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] rounded px-2 py-1 disabled:bg-[var(--bg-sunken)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              share
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            disabled={refused}
            className={`touch-target text-xs rounded px-2 py-1 disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
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
