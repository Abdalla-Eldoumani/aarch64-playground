"use client";

import type { RecentEntry } from "@/lib/playground/auto-save";
import { Select } from "@/components/ui/Select";

export interface RecentProgramsProps {
  entries: RecentEntry[];
  onLoad: (body: string) => void;
  onClear: () => void;
}

/**
 * Dropdown of the last few programs the student assembled, keyed by
 * content hash so reloading the same example doesn't push out distinct
 * work. Empty list collapses to a disabled dropdown. The Select caps its
 * own width (max-w-[14rem]), so one long recalled program name cannot
 * push the header past a 375px viewport.
 */
export function RecentPrograms({ entries, onLoad, onClear }: RecentProgramsProps) {
  const disabled = entries.length === 0;
  const options = entries.map((entry) => ({
    value: entry.id,
    label: entry.name || "(untitled)",
  }));
  if (entries.length > 0) {
    options.push({ value: "__clear__", label: "clear history" });
  }
  return (
    <Select
      placeholder="recent..."
      ariaLabel="load recent program"
      disabled={disabled}
      groups={[{ options }]}
      onSelect={(id) => {
        if (id === "__clear__") onClear();
        else {
          const entry = entries.find((x) => x.id === id);
          if (entry) onLoad(entry.body);
        }
      }}
    />
  );
}
