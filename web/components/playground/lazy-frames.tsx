"use client";

import dynamic from "next/dynamic";

/**
 * The stack frames view, behind its own chunk: lessons and practice offer it
 * beside the registers and the playground's stack tab opens on it, but the
 * landing page and a frame that never shows it must not ship its code. Named
 * so the bundle budget in package.json can glob it (lazy-panels.tsx says why).
 * Module scope, because a dynamic() call per render remounts the view.
 */
export const FramesView = dynamic(
  () =>
    import(/* webpackChunkName: "frames" */ "@/components/panels/FramesView").then(
      (m) => m.FramesView,
    ),
  { ssr: false, loading: () => null },
);
