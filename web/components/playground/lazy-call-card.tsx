"use client";

import dynamic from "next/dynamic";

/**
 * The call card behind its own chunk: only a program that calls printf or
 * scanf needs its words, so the landing page and a frame that never loads
 * one do not ship them. Named so the bundle budget in package.json can glob
 * it (lazy-panels.tsx says why). Module scope, because a dynamic() call per
 * render remounts the card.
 */
export const CallCard = dynamic(
  () =>
    import(/* webpackChunkName: "call-cards" */ "@/components/panels/CallCard").then(
      (m) => m.CallCard,
    ),
  { ssr: false, loading: () => null },
);
