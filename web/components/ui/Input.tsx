"use client";

import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Render the value in the mono family for fields that carry data (hex,
   * register names, argv) so figures align. Defaults to false (sans chrome).
   */
  mono?: boolean;
}

// On `--bg-raised` with a hairline border; the focus ring is the `--ring` token
// (resolves `--focus` -> cyan per theme) and the border lifts to the focus color
// on keyboard focus. Placeholder uses the tertiary text token. No hardcoded color.
const BASE =
  "block w-full rounded-[var(--radius-action)] px-3 min-h-[44px] text-[14px] " +
  "bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] " +
  "focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:border-[var(--focus)]";

/**
 * The base text input every form draws from. Forwards all native input
 * attributes (value, onChange, placeholder, aria-*, type), so callers treat it
 * as a styled `<input>`. Defaults `type` to "text".
 */
export function Input({ mono = false, className = "", type = "text", ...rest }: InputProps) {
  return (
    <input
      type={type}
      className={`${BASE} ${mono ? "font-mono" : "font-sans"} ${className}`}
      {...rest}
    />
  );
}
