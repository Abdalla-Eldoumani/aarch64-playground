"use client";

import { useCallback, useState } from "react";
import { fetchExample, type HandoffPayload } from "@/lib/playground/playground-handoff";
import { Select } from "@/components/ui/Select";

interface ExampleLoaderProps {
  /** Receives the complete program payload: source plus any args, stdin,
   *  and VFS fixture files the example declares. */
  onLoad: (payload: HandoffPayload) => void;
  /** Take the row's free width and truncate the label within it, for the
   *  phone bar where the picker shares a 320px row with two buttons. */
  fill?: boolean;
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
 * The examples in the order the ideas build on each other. Labels name the
 * stage, never a course week.
 */
const GROUPS: ExampleGroup[] = [
  {
    label: "First programs",
    items: [
      { name: "arithmetic", stem: "basics" },
      { name: "distance from zero", stem: "distance" },
    ],
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
      { name: "triangle area (single precision)", stem: "triangle-area" },
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
  {
    label: "Vector registers (not taught in the course)",
    items: [
      { name: "uppercase a line", stem: "vector-upper" },
      { name: "count the characters", stem: "vector-strlen" },
      { name: "sum sixteen ints", stem: "vector-sum" },
      { name: "dot product", stem: "vector-dot" },
      { name: "brighten a picture", stem: "vector-brighten" },
      { name: "mean of floats", stem: "vector-mean" },
    ],
  },
  {
    label: "Miscellaneous",
    items: [
      { name: "snake", stem: "snake" },
      { name: "data structures visualizer", stem: "dsav" },
      { name: "calculator", stem: "calc" },
      { name: "temperature converter", stem: "temp-convert" },
      { name: "two sum", stem: "two-sum" },
      { name: "deadzone", stem: "deadzone" },
    ],
  },
];

export function ExampleLoader({ onLoad, fill = false }: ExampleLoaderProps) {
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
    <div className={fill ? "flex min-w-0 flex-1 items-center gap-2" : "flex items-center gap-2"}>
      <Select
        className={fill ? "min-w-0 flex-1" : ""}
        placeholder="load example..."
        ariaLabel="load an example program"
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
