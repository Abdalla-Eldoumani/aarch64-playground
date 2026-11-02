import type { LiHTMLAttributes } from "react";

/**
 * One row of a drawn frame, as the frames view draws it: the offset on the
 * left, the box (a title over a detail), and the registers pointing into it
 * on the right. The calling-convention guide's frame diagrams draw with it
 * too, so a student meets one picture of a frame. In the playground's stack
 * tab (a size container) under 345px, too short for a 48-byte frame of three
 * locals drawn in full, each box takes one line: the title and the detail
 * side by side.
 */
export function FrameRow({
  offset,
  box,
  title,
  detail,
  marker = "",
  wrote = false,
  ring = false,
  note = "",
  ...li
}: {
  /** "fp + 16"; left out, the row has no offset column (a diagram whose
   *  boxes are whole frames). */
  offset?: string;
  /** The box's edge, fill and title ink, from frame-styles. */
  box: string;
  title: string;
  detail?: string;
  /** "sp", "fp" or "sp, fp"; a line break starts a second line. */
  marker?: string;
  /** The last step wrote into it: the amber bar. */
  wrote?: boolean;
  /** A pointer chip names it: the cyan ring. */
  ring?: boolean;
  /** Said after the detail, to a screen reader only. */
  note?: string;
} & LiHTMLAttributes<HTMLLIElement>) {
  // The amber bar is listed first, so it draws over the cyan ring.
  const marks = [wrote && "inset 3px 0 0 0 var(--amber)", ring && "inset 0 0 0 2px var(--cyan)"]
    .filter(Boolean)
    .join(", ");
  return (
    <li
      {...li}
      className={`mt-[3px] grid ${
        offset === undefined ? "grid-cols-[minmax(0,1fr)_4.5rem]" : "grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]"
      } items-center gap-2 [@container(height<345px)]:mt-px`}
    >
      {offset !== undefined && (
        <span className="text-right font-mono text-[12px] text-[var(--text-tertiary)]">{offset}</span>
      )}
      <div
        className={`px-2 py-[3px] font-sans text-[13px] leading-snug [@container(height<345px)]:flex [@container(height<345px)]:flex-wrap [@container(height<345px)]:gap-x-2 [@container(height<345px)]:py-0 [@container(height<345px)]:leading-4 ${box}`}
        style={marks ? { boxShadow: marks } : undefined}
      >
        <div className="break-words font-medium">{title}</div>
        <div className="break-words text-[12px] text-[var(--text-secondary)]">
          {detail}
          {wrote && <span className="sr-only">, just written</span>}
          {note && <span className="sr-only">{note}</span>}
        </div>
      </div>
      <span className="whitespace-pre font-mono text-[12px] text-[var(--text-secondary)]">
        {marker && (
          <>
            <span aria-hidden="true">← </span>
            {marker}
            <span className="sr-only"> points here</span>
          </>
        )}
      </span>
    </li>
  );
}
