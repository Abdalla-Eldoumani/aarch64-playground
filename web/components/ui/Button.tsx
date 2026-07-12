"use client";

import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual treatment. `primary` is the filled cyan action (the one a student
   * reaches for: Assemble, Run, Check); `secondary` sits on an elevated surface
   * for supporting actions; `ghost` is transparent until hovered. Defaults to
   * `primary`.
   */
  variant?: ButtonVariant;
}

// 44px tall so coarse pointers can hit it; the focus ring is the `--ring` token
// (two-layer box-shadow that resolves `--focus` -> cyan per theme) shown only on
// keyboard focus. Every color reads from a token; nothing is hardcoded.
// `active:translate-y-px` is the press: one device pixel of travel on the
// pointer-down frame, discrete state rather than an animation, so it reads
// under prefers-reduced-motion without motion over time.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] " +
  "px-4 min-h-[44px] font-sans text-[14px] font-medium transition-colors " +
  "focus:outline-none focus-visible:[box-shadow:var(--ring)] " +
  "active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

// Hover mixes a step of the label's ink into the fill instead of thinning the
// control with opacity, so the label gains contrast while hovered and the
// shift lands correctly in all three themes (brighter on dark, deeper on
// light) from the same rule.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--cyan)] text-[var(--on-cyan)] " +
    "hover:bg-[color-mix(in_srgb,var(--cyan)_88%,var(--text-primary))]",
  secondary:
    "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] " +
    "hover:border-[var(--border-strong)] hover:bg-[color-mix(in_srgb,var(--bg-elevated)_92%,var(--text-primary))]",
  ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
};

/**
 * The base action button every screen draws from. Forwards all native button
 * attributes (onClick, disabled, aria-*, type), so callers treat it as a styled
 * `<button>`. Defaults `type` to "button" to avoid accidental form submits.
 */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest} />
  );
}
