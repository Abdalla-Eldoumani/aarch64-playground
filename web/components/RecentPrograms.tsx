"use client";

import type { RecentEntry } from "@/lib/auto-save";

export interface RecentProgramsProps {
  entries: RecentEntry[];
  onLoad: (body: string) => void;
  onClear: () => void;
}

/**
 * Dropdown of the last few programs the student assembled, keyed by
 * content hash so reloading the same example doesn't push out distinct
 * work. Empty list collapses to a disabled dropdown.
 */
export function RecentPrograms({ entries, onLoad, onClear }: RecentProgramsProps) {
  const disabled = entries.length === 0;
  return (
    <select
      onChange={(e) => {
        const id = e.target.value;
        if (id === "__clear__") onClear();
        else {
          const entry = entries.find((x) => x.id === id);
          if (entry) onLoad(entry.body);
        }
        e.target.value = "";
      }}
      defaultValue=""
      disabled={disabled}
      aria-label="load recent program"
      className="bg-[var(--bg-sunken)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
    >
      <option value="" disabled>
        recent...
      </option>
      {entries.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name || "(untitled)"}
        </option>
      ))}
      {entries.length > 0 && (
        <option value="__clear__">clear history</option>
      )}
    </select>
  );
}
