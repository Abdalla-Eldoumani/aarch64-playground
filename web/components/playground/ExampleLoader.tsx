"use client";

import { useCallback, useState } from "react";
import { fetchExample, type HandoffPayload } from "@/lib/playground/playground-handoff";
import { Select } from "@/components/ui/Select";

interface ExampleLoaderProps {
  /** Receives the complete program payload: source plus any args, stdin,
   *  and VFS fixture files the example declares. */
  onLoad: (payload: HandoffPayload) => void;
}

interface Example {
  name: string;
  stem: string;
}

interface ExampleGroup {
  label: string;
  items: Example[];
}

/**
 * Examples presented as an eight-stage level-up path, in the order the
 * concepts build: first programs, data and memory, stack and locals,
 * records and arrays, subroutines, static data and arguments, floating
 * point, files and I/O. Each stage carries at least one program; the
 * labels are the stage names, with no course-week text.
 */
const GROUPS: ExampleGroup[] = [
  {
    label: "First programs",
    items: [{ name: "arithmetic", stem: "basics" }],
  },
  {
    label: "Data and memory",
    items: [{ name: "globals (load + store)", stem: "globals" }],
  },
  {
    label: "Stack and locals",
    items: [{ name: "locals (sum + product)", stem: "locals" }],
  },
  {
    label: "Records and arrays",
    items: [
      { name: "scores (scanf + avg)", stem: "array-scores" },
      { name: "student record", stem: "student-record" },
    ],
  },
  {
    label: "Subroutines",
    items: [
      { name: "find max", stem: "find-max" },
      { name: "is prime", stem: "is-prime" },
    ],
  },
  {
    label: "Static data and command-line arguments",
    items: [
      { name: "static counter", stem: "static-counter" },
      { name: "command-line args", stem: "command-line-args" },
    ],
  },
  {
    label: "Floating point",
    items: [
      { name: "circle area", stem: "circle-area" },
      { name: "triangle area (single)", stem: "triangle-area" },
    ],
  },
  {
    label: "Files and I/O",
    items: [
      { name: "hello (write)", stem: "hello" },
      { name: "echo (read)", stem: "echo" },
      { name: "write file", stem: "write-file" },
      { name: "read file", stem: "read-file" },
      { name: "copy file", stem: "copy-file" },
    ],
  },
];

export function ExampleLoader({ onLoad }: ExampleLoaderProps) {
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (stem: string) => {
      if (!stem) return;

      setLoadError(null);
      try {
        const payload = await fetchExample(stem);
        const label = (() => {
          for (const group of GROUPS) {
            for (const item of group.items) {
              if (item.stem === stem) return item.name;
            }
          }
          return stem;
        })();
        onLoad({ ...payload, label });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "failed to load example");
      }
    },
    [onLoad],
  );

  return (
    <div className="flex items-center gap-2">
      <Select
        placeholder="load example..."
        ariaLabel="Load example program"
        onSelect={(stem) => void handleSelect(stem)}
        groups={GROUPS.map((group) => ({
          label: group.label,
          options: group.items.map((ex) => ({ value: ex.stem, label: ex.name })),
        }))}
      />
      {loadError && (
        <span className="text-[var(--danger)] text-xs" role="alert">
          {loadError}
        </span>
      )}
    </div>
  );
}
