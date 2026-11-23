"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

/**
 * The text typed into a server-rendered field before the page's script ran,
 * or null when there is none or React already holds it. Hydration leaves
 * that text in the field but tells React nothing, and the field's next
 * render writes React's value back over it.
 */
export function typedBeforeHydration(field: HTMLInputElement | null, value: string): string | null {
  const typed = field?.value ?? "";
  return typed !== "" && typed !== value ? typed : null;
}

/**
 * Hands text typed before hydration to `onChange` once, on mount, as if it
 * had been typed after. Mount effects run before any later render commits,
 * so the field still holds the text when it is read.
 */
export function useTypedBeforeHydration(
  field: RefObject<HTMLInputElement | null>,
  value: string,
  onChange: (typed: string) => void,
): void {
  const adopt = useEffectEvent(() => {
    const typed = typedBeforeHydration(field.current, value);
    if (typed !== null) onChange(typed);
  });
  useEffect(() => {
    adopt();
  }, []);
}
