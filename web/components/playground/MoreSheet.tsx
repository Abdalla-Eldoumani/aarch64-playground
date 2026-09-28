"use client";

import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { NAV_ROUTES } from "@/lib/content/site";
import { CloseIcon } from "@/components/chrome/SiteIcons";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

export interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  /** The playground's own controls in groups; a group that brings its own
   *  label (the toolbar does) leaves `label` out. */
  sections: { key: string; label?: string; content: ReactNode }[];
}

// The toolbar's group-label voice, so every group in the sheet reads alike.
const HEADING =
  "font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] [@media(pointer:coarse)]:text-[12px]";

/**
 * The header band's controls on a phone, where one row showed only four of
 * them. It rises from the bottom, near the thumb, and holds the site links,
 * since the phone playground drops the site bar to give the code room.
 */
export function MoreSheet({ open, onClose, sections }: MoreSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(open, panelRef, onClose);
  if (!open) return null;

  return createPortal(
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[65] bg-black/60" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-modal-rise fixed inset-x-0 bottom-0 z-[70] flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-[var(--radius-card)] border-t border-[var(--border-strong)] bg-[var(--bg-panel)] pt-2 pb-[calc(1rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] [box-shadow:var(--shadow-overlay)]"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-sans text-[15px] font-medium text-[var(--text-primary)]">
            more
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
          >
            <CloseIcon />
          </button>
        </div>
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-2">
            {section.label && <h3 className={HEADING}>{section.label}</h3>}
            <div className="flex flex-wrap items-center gap-2">{section.content}</div>
          </section>
        ))}
        <nav aria-label="site" className="flex flex-col gap-2">
          <h3 className={HEADING}>site</h3>
          <div className="grid grid-cols-2 gap-2">
            {NAV_ROUTES.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                onClick={onClose}
                aria-current={route.href === "/playground" ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 font-sans text-[14px] focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                  route.href === "/playground" ? "text-[var(--cyan)]" : "text-[var(--text-secondary)]"
                }`}
              >
                {route.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </>,
    document.body,
  );
}
