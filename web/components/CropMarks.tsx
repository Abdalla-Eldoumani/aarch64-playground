/**
 * Crop marks: four L-shaped calibration marks inset at the corners of a
 * reading surface, as on a datasheet proof. Pure CSS borders, decorative
 * (`aria-hidden`), hidden on phones where the margins cannot spare them.
 * The parent must be `position: relative`.
 */
const CORNERS = [
  "left-[10px] top-[10px] border-l border-t",
  "right-[10px] top-[10px] border-r border-t",
  "left-[10px] bottom-[10px] border-l border-b",
  "right-[10px] bottom-[10px] border-r border-b",
] as const;

export function CropMarks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50 hidden sm:block">
      {CORNERS.map((corner) => (
        <span
          key={corner}
          className={`absolute h-[14px] w-[14px] border-[var(--crop)] ${corner}`}
        />
      ))}
    </div>
  );
}
