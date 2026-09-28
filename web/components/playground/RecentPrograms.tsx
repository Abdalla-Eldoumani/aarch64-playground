"use client";

import type { RecentEntry } from "@/lib/playground/auto-save";
import { Select } from "@/components/ui/Select";

export interface RecentProgramsProps {
  entries: RecentEntry[];
  onLoad: (body: string) => void;
  onClear: () => void;
}

/**
 * No width cap here: the Select caps its own (max-w-[14rem]), so a long
 * program name cannot push the header past a 375px screen.
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
