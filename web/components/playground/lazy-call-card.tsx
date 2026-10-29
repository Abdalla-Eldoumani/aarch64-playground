"use client";

import dynamic from "next/dynamic";

/**
 * The call card behind its own chunk, so no page's own scripts carry its
 * words: the browser fetches it when a console first shows a program in
 * hosted mode, as the landing page's hero does once it assembles. Named so
 * the bundle budget in package.json can glob it (lazy-panels.tsx says why).
 * Module scope, because a dynamic() call per render remounts the card.
 */
export const CallCard = dynamic(
  () =>
    import(/* webpackChunkName: "call-cards" */ "@/components/panels/CallCard").then(
      (m) => m.CallCard,
    ),
  { ssr: false, loading: () => null },
);
