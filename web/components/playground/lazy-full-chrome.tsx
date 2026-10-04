"use client";

import dynamic from "next/dynamic";
import { fontsSettled } from "@/components/playground/fonts-settled";

// Dynamic, so the landing hero, which mounts EmbeddablePlayground in embed chrome,
// never ships the full debugger. It waits for the web fonts too: mounting in
// the fallback face and swapping later re-wraps the header band and moves the
// editor (fonts-settled.ts has the measurement).
export const FullChromeSurface = dynamic(
  () =>
    Promise.all([
      import("@/components/playground/FullChromeSurface"),
      fontsSettled(),
    ]).then(([m]) => m.FullChromeSurface),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)]">
        loading emulator...
      </div>
    ),
  },
);
