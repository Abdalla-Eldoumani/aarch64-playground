/**
 * The keyboard shortcut drawn inside a button ("F6", "Ctrl+K"). Hidden on
 * touch screens, which have no such keys. currentColor at full strength keeps
 * the chip readable (WCAG AA) on every button style. CSS draws the keys from
 * data-keys: as text, even aria-hidden, the visible label read "assemble F6"
 * against the name "assemble", which fails label-in-name.
 */
export function ShortcutChip({ keys, className = "" }: { keys: string; className?: string }) {
  return (
    <kbd
      aria-hidden="true"
      data-keys={keys}
      className={`hidden sm:inline-block [@media(pointer:coarse)]:hidden text-[12px] font-mono leading-none border border-current rounded px-1 py-[2px] after:content-[attr(data-keys)] ${className}`}
    />
  );
}
