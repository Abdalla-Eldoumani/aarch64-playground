/**
 * Bit ruler: a 26px strip of 32 tick marks — one per bit of an instruction
 * word — with bit-index labels on the nibble boundaries. Pure CSS (a
 * repeating-linear-gradient draws the ticks), zero assets. Rides under the
 * site nav on the landing page as the brand's calibration strip. Decorative:
 * `aria-hidden` so screen readers skip it. Under sm only every-8th label
 * renders so the strip never crowds.
 */
const LABELED_BITS = [31, 28, 24, 20, 16, 12, 8, 4, 0];

export function BitRuler({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-[26px] w-full overflow-hidden border-b border-[var(--border)] ${className}`}
    >
      {/* 32 ticks, 6px tall, one per 1/32 of the width. */}
      <div
        className="absolute inset-x-0 top-0 h-[6px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px calc(100% / 32))",
        }}
      />
      {LABELED_BITS.map((bit) => {
        // Bit 31 sits at the left edge, bit 0 at the right; center each label
        // under its tick and clamp the ends inside the strip.
        const percent = ((31 - bit) / 31) * 100;
        const everyEight = bit % 8 === 0 || bit === 31;
        return (
          <span
            key={bit}
            className={`absolute top-[9px] font-mono text-[9px] leading-none text-[var(--text-tertiary)] ${
              everyEight ? "" : "hidden sm:inline"
            }`}
            style={{
              // Pin the edge labels a step inside the strip so 31 and 0
              // never clip against the viewport.
              left: bit === 31 ? "4px" : bit === 0 ? "auto" : `${percent}%`,
              right: bit === 0 ? "4px" : "auto",
              transform: bit === 31 || bit === 0 ? "none" : "translateX(-50%)",
            }}
          >
            {bit}
          </span>
        );
      })}
    </div>
  );
}
