"use client";

import type { ReactNode } from "react";
import { usePersistedFlag } from "@/components/panels/register-panel-settings";
import { PaneSwitch } from "@/components/playground/PaneSwitch";

export const BYTES_KEY = "aarch64-playground:stack-bytes";

/** The playground's stack tab: the frames as the course draws them, or the
 *  raw bytes from sp, switched in the tab's header and kept per viewer.
 *  Frames come first. */
export function StackTab({ frames, bytes }: { frames: ReactNode; bytes: ReactNode }) {
  const [showBytes, setShowBytes] = usePersistedFlag(BYTES_KEY);
  return (
    <div className="flex h-full flex-col">
      <PaneSwitch label="frames or bytes" names={["frames", "bytes"]} second={showBytes} onChange={setShowBytes} />
      <div className="min-h-0 flex-1 overflow-auto">{showBytes ? bytes : frames}</div>
    </div>
  );
}
