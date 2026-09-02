"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The repository's star count, carried from a route's server layout to the
 * client component that renders the nav. A layout hands its children no props,
 * and the playground page is a client component that owns its own bar, so the
 * count reaches it through this one value instead.
 *
 * Null is the count the nav already knows how to render: the icon-only link it
 * shows whenever the lookup fails. That is also the default here, so a nav
 * mounted outside a provider behaves like a failed lookup rather than breaking.
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
