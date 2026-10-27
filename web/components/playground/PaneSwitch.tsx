"use client";

interface PaneSwitchProps {
  /** The group's name for a screen reader. */
  label: string;
  /** The two views, in the order they show. */
  names: readonly [string, string];
  /** Whether the second view is the one showing. */
  second: boolean;
  onChange: (second: boolean) => void;
}

/**
 * A pane's two versions side by side as pressed buttons, in the single-pane
 * switch's look: the selected one in cyan with its bar under it. 28px rows
 * under a mouse keep the pane's rows; a touch screen gets 44px targets.
 */
export function PaneSwitch({ label, names, second, onChange }: PaneSwitchProps) {
  return (
    <div role="group" aria-label={label} className="flex border-b border-[var(--border)] bg-[var(--bg-sunken)]">
      {names.map((name, i) => {
        const on = second === (i === 1);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(i === 1)}
            className={`min-h-[28px] px-3 font-sans text-[12px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cyan)] [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] ${
              on
                ? "text-[var(--cyan)] [box-shadow:inset_0_-2px_0_0_var(--cyan)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
