"use client";

import {
  formatDownload,
  formatSavedDate,
  saveEveryPage,
  useOfflineSnapshot,
} from "@/lib/playground/offline-status";

const FAILURE_TEXT = {
  network: "Saving stopped because the connection dropped. Try again when you are online.",
  storage: "Saving stopped because this device is out of space. Free some up, then try again.",
  update: "Saving stopped because the site was updated. Close it, open it again, then save.",
} as const;

const ANNOUNCEMENT = {
  started: "Saving every page for offline use.",
  saved: "Every page is now available offline.",
} as const;

/**
 * "Save every page for offline": the lessons, practice, the reference and
 * the rest, on top of the playground the service worker saves by itself.
 * One button carries every state, so focus stays put while a save runs and
 * when it ends. Renders nothing until the worker answers, which it never
 * does in a browser without one.
 */
export function SaveOffline({ className = "" }: { className?: string }) {
  const snapshot = useOfflineSnapshot();
  if (!snapshot) return null;
  const { status, change } = snapshot;
  const { saving, savedAt, failure } = status;
  const canSave = !saving && !savedAt && failure !== "update";

  let label = "Save every page for offline";
  let detail = formatDownload(status.bytes);
  if (saving) {
    label = "Saving every page";
    detail = `${saving.done} of ${saving.total}`;
  } else if (savedAt) {
    label = "Available offline";
    detail = `saved ${formatSavedDate(savedAt)}`;
  }
  const announcement =
    change === "failed" && failure ? FAILURE_TEXT[failure] : change && change !== "failed" ? ANNOUNCEMENT[change] : "";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        aria-disabled={!canSave}
        onClick={canSave ? saveEveryPage : undefined}
        className={`touch-target inline-flex min-h-[44px] flex-wrap items-center gap-x-2 rounded-[var(--radius-control)] text-left font-sans text-[14px] text-[var(--text-secondary)] focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
          canSave ? "transition-colors hover:text-[var(--cyan)]" : "cursor-default"
        }`}
      >
        <span>{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-[var(--text-tertiary)]">{detail}</span>
      </button>
      {saving ? (
        // The fill steps once per saved page; the count in the button is what
        // a screen reader hears.
        <div aria-hidden="true" className="h-0.5 w-full overflow-hidden bg-[var(--border)]">
          <div
            className="h-full origin-left bg-[var(--cyan)]"
            style={{ transform: `scaleX(${saving.total > 0 ? saving.done / saving.total : 1})` }}
          />
        </div>
      ) : null}
      {failure ? (
        <p className="max-w-xs font-sans text-[13px] leading-snug text-[var(--text-secondary)]">
          {FAILURE_TEXT[failure]}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
