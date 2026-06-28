"use client";

import { useCallback, useState } from "react";

interface ExampleLoaderProps {
  onLoad: (source: string, label?: string) => void;
}

interface Example {
  name: string;
  file: string;
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
    items: [{ name: "arithmetic", file: "/examples/cpsc355/basics.s" }],
  },
  {
    label: "Data and memory",
    items: [
      { name: "globals (load + store)", file: "/examples/cpsc355/globals.s" },
    ],
  },
  {
    label: "Stack and locals",
    items: [
      { name: "locals (sum + product)", file: "/examples/cpsc355/locals.s" },
    ],
  },
  {
    label: "Records and arrays",
    items: [
      { name: "scores (scanf + avg)", file: "/examples/cpsc355/array-scores.s" },
      { name: "student record", file: "/examples/cpsc355/student-record.s" },
    ],
  },
  {
    label: "Subroutines",
    items: [
      { name: "find max", file: "/examples/cpsc355/find-max.s" },
      { name: "is prime", file: "/examples/cpsc355/is-prime.s" },
    ],
  },
  {
    label: "Static data and command-line arguments",
    items: [
      { name: "static counter", file: "/examples/cpsc355/static-counter.s" },
      { name: "command-line args", file: "/examples/cpsc355/command-line-args.s" },
    ],
  },
  {
    label: "Floating point",
    items: [
      { name: "circle area", file: "/examples/cpsc355/circle-area.s" },
    ],
  },
  {
    label: "Files and I/O",
    items: [
      { name: "hello (write)", file: "/examples/cpsc355/hello.s" },
      { name: "echo (read)", file: "/examples/cpsc355/echo.s" },
      { name: "write file", file: "/examples/cpsc355/write-file.s" },
      { name: "read file", file: "/examples/cpsc355/read-file.s" },
      { name: "copy file", file: "/examples/cpsc355/copy-file.s" },
    ],
  },
];

export function ExampleLoader({ onLoad }: ExampleLoaderProps) {
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const file = e.target.value;
      if (!file) return;

      setLoadError(null);
      try {
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        const label = (() => {
          for (const group of GROUPS) {
            for (const item of group.items) {
              if (item.file === file) return item.name;
            }
          }
          return file;
        })();
        onLoad(text, label);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "failed to load example");
      } finally {
        e.target.value = "";
      }
    },
    [onLoad],
  );

  return (
    <div className="flex items-center gap-2">
      <select
        onChange={handleSelect}
        defaultValue=""
        className="bg-[var(--bg-raised)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] max-w-[14rem]"
        aria-label="Load example program"
      >
        <option value="" disabled>
          load example...
        </option>
        {GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((ex) => (
              <option key={ex.file} value={ex.file}>
                {ex.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {loadError && (
        <span className="text-[var(--danger)] text-xs" role="alert">
          {loadError}
        </span>
      )}
    </div>
  );
}
