import type { BoxKind } from "@/lib/emulator/stack-frames";

// The frames view's boxes, which the draw-the-frame exercise and the
// calling-convention guide's diagrams draw too, so a student meets one
// picture of a frame. Saved registers sit on a raised
// surface in the approved look's purple (the number ink: the register ink is
// pink in the dark themes and read as the danger red beside it), locals on a
// faint success tint, and the gaps are dashed outlines; a changed saved
// register takes the danger style instead. Every tint mixes over --bg-base,
// so its text contrast is the one the theme tests hold for 15% fills.
export const KIND_STYLE: Record<BoxKind, string> = {
  saved: "border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--syntax-number)]",
  local: "border border-[var(--border)] bg-[color-mix(in_srgb,var(--success)_10%,var(--bg-base))] text-[var(--success)]",
  padding: "border border-dashed border-[var(--border-strong)] text-[var(--text-secondary)]",
  reserved: "border border-dashed border-[var(--border-strong)] text-[var(--text-secondary)]",
};

export const OVERWRITTEN =
  "border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-base))] text-[var(--danger)]";

/** A whole frame drawn as one box, which only the guide's diagrams draw. */
export const WHOLE_FRAME = "border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-primary)]";
