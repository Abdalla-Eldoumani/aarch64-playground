"use client";

import { createElement, useCallback, useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";

export interface SideScrollProps {
  /** The element that scrolls: a code box's pre, or a list laid out as a row. */
  as: "pre" | "ul";
  /** Classes for the box around the scroller; margins go here. */
  className?: string;
  /** Classes for the scroller itself, which always scrolls sideways. */
  scrollerClassName: string;
  /** The fade's right corners and colour, matched to the scroller's radius and
   *  background so it sits inside the border. */
  fadeClassName: string;
  children: ReactNode;
}

/**
 * A box whose content scrolls sideways inside it, with a fade on the right
 * edge while some of it is out of view: a phone shows no scrollbar until a
 * swipe, so the fade is the only sign there is more. Code boxes (ScrollingPre)
 * and an encoding's bit-field row both draw through it, so the cue is one.
 */
export function SideScroll({ as, className = "", scrollerClassName, fadeClassName, children }: SideScrollProps) {
  const scrollerRef = useRef<HTMLElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (el) setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, children]);
  // Chromium leaves a focused item partly past the edge, under the fade; the
  // scroll padding (the fade's width) parks it clear of the fade.
  const reveal = useCallback((event: FocusEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) return;
    event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  return (
    <div className={`relative ${className}`}>
      {createElement(
        as,
        { ref: scrollerRef, onScroll: measure, onFocus: reveal, className: `overflow-x-auto scroll-pr-8 ${scrollerClassName}` },
        children,
      )}
      {moreRight && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-px right-px w-8 bg-gradient-to-l to-transparent ${fadeClassName}`}
        />
      )}
    </div>
  );
}
