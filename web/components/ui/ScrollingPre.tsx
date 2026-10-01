"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface ScrollingPreProps {
  /** Classes for the box around the pre; margins go here, not on the pre. */
  className?: string;
  /** Classes for the pre itself, which always scrolls sideways. */
  preClassName: string;
  children: ReactNode;
}

/**
 * A code box whose long lines scroll inside it, with a fade on the right edge
 * while a line runs past it: a phone shows no scrollbar until a swipe, so the
 * fade is the only sign there is more. CodeBlock and the lesson Markdown's
 * fenced code both draw through it, so the cue looks the same everywhere.
 */
export function ScrollingPre({ className = "", preClassName, children }: ScrollingPreProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  const measure = useCallback(() => {
    const pre = preRef.current;
    if (pre) setMoreRight(pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1);
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, children]);

  return (
    <div className={`relative ${className}`}>
      <pre ref={preRef} onScroll={measure} className={`overflow-x-auto ${preClassName}`}>
        {children}
      </pre>
      {moreRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-px right-px w-8 rounded-r-[var(--radius-card)] bg-gradient-to-l from-[var(--bg-sunken)] to-transparent"
        />
      )}
    </div>
  );
}
