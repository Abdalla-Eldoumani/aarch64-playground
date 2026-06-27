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
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] " +
  "px-4 min-h-[44px] font-sans text-[14px] font-medium transition-colors " +
  "focus:outline-none focus-visible:shadow-[var(--ring)] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[var(--cyan)] text-[var(--on-cyan)] hover:opacity-90",
  secondary:
    "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-strong)]",
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
