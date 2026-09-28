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

// 44px tall so a finger can hit it. The press is one pixel of travel, a state
// change rather than an animation, so it still shows under reduced motion.
const BASE =
  "inline-flex items-center justify-center gap-2 " +
  "px-4 min-h-[44px] font-sans text-[14px] font-medium transition-colors " +
  "focus:outline-none focus-visible:[box-shadow:var(--ring)] " +
  "active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

// Hover mixes some label color into the fill rather than fading it with
// opacity, so the label gains contrast in all three themes from one rule.
// Primary keeps the rounder action corner; the others use the square one.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "rounded-[var(--radius-action)] bg-[var(--cyan)] text-[var(--on-cyan)] " +
    "hover:bg-[color-mix(in_srgb,var(--cyan)_88%,var(--text-primary))]",
  secondary:
    "rounded-[var(--radius-control)] " +
    "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] " +
    "hover:border-[var(--border-strong)] hover:bg-[color-mix(in_srgb,var(--bg-elevated)_92%,var(--text-primary))]",
  ghost:
    "rounded-[var(--radius-control)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
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
