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
 * The jump table's list, arming its per-row boot-flash stagger only once the
 * client has taken over. The arming class is deliberately absent from the
 * server HTML: an entrance that runs during first paint costs FCP on a
 * throttled phone, and the landing rule is that entrances answer hydration,
 * never first paint. The rows arrive as children so they stay server-rendered
 * and this file is the only client code the section carries.
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
