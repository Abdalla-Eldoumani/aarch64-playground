"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Carries the star count from a server layout to the client nav, because a
 * layout passes its children no props. Null shows the icon-only link; as the
 * default it makes a nav outside a provider act like a failed lookup.
 */
const StarCountContext = createContext<number | null>(null);

export function StarCountProvider({
  stars,
  children,
}: {
  stars: number | null;
  children: ReactNode;
}) {
  return <StarCountContext.Provider value={stars}>{children}</StarCountContext.Provider>;
}

export function useStarCount(): number | null {
  return useContext(StarCountContext);
}
