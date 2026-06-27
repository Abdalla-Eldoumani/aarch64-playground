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
 * Examples grouped by course topic so students can find the example that
 * maps to the concept they're learning (stack and locals, records,
 * arrays, floating point, I/O).
 */
const GROUPS: ExampleGroup[] = [
  {
    label: "cpsc 355 — basics",
    items: [{ name: "arithmetic", file: "/examples/cpsc355/basics.s" }],
  },
  {
    label: "cpsc 355 — stack and locals",
    items: [
      { name: "scores (scanf + avg)", file: "/examples/cpsc355/array-scores.s" },
    ],
  },
  {
    label: "cpsc 355 — records and arrays",
    items: [
      { name: "student record", file: "/examples/cpsc355/student-record.s" },
      { name: "find max", file: "/examples/cpsc355/find-max.s" },
    ],
  },
  {
    label: "cpsc 355 — subroutines and static data",
    items: [
      { name: "static counter", file: "/examples/cpsc355/static-counter.s" },
      { name: "command-line args", file: "/examples/cpsc355/command-line-args.s" },
    ],
  },
  {
    label: "cpsc 355 — floating point",
    items: [
      { name: "circle area (fp)", file: "/examples/cpsc355/circle-area.s" },
      { name: "is prime", file: "/examples/cpsc355/is-prime.s" },
    ],
  },
  {
    label: "cpsc 355 — I/O and syscalls",
    items: [
      { name: "hello (write)", file: "/examples/cpsc355/hello.s" },
      { name: "echo (read)", file: "/examples/cpsc355/echo.s" },
      { name: "write file", file: "/examples/cpsc355/write-file.s" },
      { name: "read file", file: "/examples/cpsc355/read-file.s" },
      { name: "copy file", file: "/examples/cpsc355/copy-file.s" },
    ],
  },
  {
    label: "starters (A1–A6)",
    items: [
      { name: "A1 min cubic", file: "/examples/cpsc355/starters/A1_min_cubic.asm" },
      {
        name: "A2 multiply via shift-add",
        file: "/examples/cpsc355/starters/A2_mul_shift_add.asm",
      },
      { name: "A3 sort array", file: "/examples/cpsc355/starters/A3_sort_array.asm" },
      {
        name: "A4 struct + subroutines",
        file: "/examples/cpsc355/starters/A4_struct_subroutine.asm",
      },
      {
        name: "A5 global RPN calculator",
        file: "/examples/cpsc355/starters/A5_global_rpn.asm",
      },
      { name: "A6 file I/O + fp", file: "/examples/cpsc355/starters/A6_file_io.asm" },
    ],
  },
  {
    label: "bare-metal classics",
    items: [
      { name: "factorial", file: "/examples/factorial.s" },
      { name: "fibonacci", file: "/examples/fibonacci.s" },
      { name: "string reverse", file: "/examples/string-reverse.s" },
      { name: "bubble sort", file: "/examples/bubble-sort.s" },
      { name: "gcd", file: "/examples/gcd.s" },
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
