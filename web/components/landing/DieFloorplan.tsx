/**
 * The interface drawn as a chip floorplan, echoing the playground's own panel
 * layout; the execute block is amber because that is the machine acting.
 * Decorative (`aria-hidden`) and CSS only.
 */
const BLOCK_LABEL =
  "flex items-start border border-[var(--border)] px-2 py-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]";

export function DieFloorplan({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative grid w-[300px] flex-shrink-0 grid-cols-2 grid-rows-[64px_64px_64px] gap-1.5 border border-[var(--border-strong)] p-3.5 ${className}`}
    >
      {/* Pin-one marker on the package edge. */}
      <span className="absolute -top-[5px] left-5 h-[4px] w-[4px] rounded-full bg-[var(--amber)]" />
      <span className={`col-span-2 justify-between ${BLOCK_LABEL}`}>
        fetch / decode
        <span className="text-[var(--amber)]">pc {"▸"}</span>
      </span>
      <span
        className={`${BLOCK_LABEL} border-[var(--amber)] text-[var(--amber)]`}
        style={{ backgroundColor: "color-mix(in srgb, var(--amber) 7%, transparent)" }}
      >
        exec
      </span>
      <span className={BLOCK_LABEL}>regfile</span>
      <span className={BLOCK_LABEL}>mem</span>
      <span className={BLOCK_LABEL}>i/o</span>
    </div>
  );
}
