"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// Same shape the playground page uses for its `?embed=1` read: a store that
// never changes, so the server snapshot renders and the client snapshot takes
// over at hydration with no setState in an effect.
function subscribe(): () => void {
  return () => {};
}
function armedOnClient(): boolean {
  return true;
}
function armedOnServer(): boolean {
  return false;
}

/**
 * The landing's route list. The flash class is added only after hydration,
 * since an entrance during first paint slows first paint on a slow phone. The
 * rows come in as children so they stay server-rendered.
 */
export function BootFlashList({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const armed = useSyncExternalStore(subscribe, armedOnClient, armedOnServer);
  return (
    <ul className={armed ? `${className} boot-flash-armed` : className}>{children}</ul>
  );
}
