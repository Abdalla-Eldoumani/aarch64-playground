"use client";

import dynamic from "next/dynamic";

/**
 * The lazily loaded half of the playground's panel set. These live outside
 * EmbeddablePlayground so the shell reads as composition, and they stay in
 * ONE module because the property that matters is shared: every entry is a
 * full-chrome or heavy panel, so a multi-embed page (and the embed / checker
 * chrome, which renders none of them) never ships their code.
 *
 * Module scope on purpose: a dynamic() call re-evaluated per render would
 * hand React a new component type every time and remount the panel.
 */

export const InstructionView = dynamic(
  () => import("@/components/panels/InstructionView").then((m) => m.InstructionView),
  { ssr: false },
);
export const MemoryPanel = dynamic(
  () => import("@/components/panels/MemoryPanel").then((m) => m.MemoryPanel),
  { ssr: false },
);
export const StackPanel = dynamic(
  () => import("@/components/panels/StackPanel").then((m) => m.StackPanel),
  { ssr: false },
);
export const WatchPanel = dynamic(
  () => import("@/components/panels/WatchPanel").then((m) => m.WatchPanel),
  { ssr: false },
);
export const MemoryWatches = dynamic(
  () => import("@/components/panels/MemoryWatches").then((m) => m.MemoryWatches),
  { ssr: false },
);
export const BaseConverter = dynamic(
  () => import("@/components/panels/BaseConverter").then((m) => m.BaseConverter),
  { ssr: false },
);
export const ReplayScrubber = dynamic(
  () => import("@/components/playground/ReplayScrubber").then((m) => m.ReplayScrubber),
  { ssr: false },
);
export const SavesPanel = dynamic(
  () => import("@/components/panels/SavesPanel").then((m) => m.SavesPanel),
  { ssr: false },
);
export const TerminalPane = dynamic(
  // Named so the bundle budget in package.json can glob xterm's chunk by
  // name; a hashed webpack id moves with any change to the module graph,
  // and the budget that used to point at one silently measured nothing.
  () =>
    import(/* webpackChunkName: "terminal" */ "@/components/panels/TerminalPane").then(
      (m) => m.TerminalPane,
    ),
  { ssr: false, loading: () => null },
);
export const TutorialRunner = dynamic(
  () => import("@/components/playground/TutorialRunner").then((m) => m.TutorialRunner),
  { ssr: false },
);
